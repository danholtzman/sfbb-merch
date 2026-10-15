#!/usr/bin/env python3
"""Stopped-app backups with constrained extraction and SQLite/asset validation."""
import hashlib,io,json,os,pathlib,re,shutil,sqlite3,sys,tarfile,tempfile,datetime
sys.dont_write_bytecode=True
from release import digest,validate_manifest

def release_data(source):
    if source=='none': return None
    if source=='env': return json.loads(os.environ['SFBB_BACKUP_RELEASE_JSON'])
    return json.loads(pathlib.Path(source).read_text())
ASSET=re.compile(r'[a-f0-9-]{36}\.(png|jpg)')
DBFILES={'sfbb.sqlite','sfbb.sqlite-wal','sfbb.sqlite-shm','sfbb.sqlite-journal'}

def regular(path):
    if path.is_symlink() or not path.is_file(): raise ValueError('Expected a regular file: '+path.name)

def inspect_data(data,release):
    if data.is_symlink() or (data/'assets').is_symlink(): raise ValueError('Unsafe data/assets directory')
    dbpath=data/'sfbb.sqlite'
    if not dbpath.exists():
        if release is not None: raise ValueError('Recorded release has no database; recover before backing up')
        return True
    regular(dbpath)
    if release is None: raise ValueError('Database exists without an active release manifest')
    validate_manifest(release,release['releaseTag'])
    db=sqlite3.connect(dbpath.as_uri()+'?mode=ro',uri=True)
    try:
        db.execute('PRAGMA trusted_schema=OFF')
        if db.execute('PRAGMA integrity_check').fetchall()!=[('ok',)]: raise ValueError('SQLite integrity check failed')
        if db.execute('PRAGMA foreign_key_check').fetchall(): raise ValueError('SQLite foreign keys are inconsistent')
        migrations=db.execute('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name').fetchall()
        if [x[0] for x in migrations]!=sorted(release['migrations']): raise ValueError('Database migration list does not match recorded release')
        if db.execute('SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL').fetchone()[0]: raise ValueError('Database contains a failed/incomplete migration')
        assets=db.execute('SELECT storageKey,byteSize,sha256 FROM Asset WHERE id IN (SELECT frontAssetId FROM ArtworkSet UNION SELECT backAssetId FROM ArtworkSet UNION SELECT assetId FROM BlankPhoto)').fetchall()
        for key,size,sha in assets:
            if not isinstance(key,str) or not ASSET.fullmatch(key): raise ValueError('Unsafe referenced asset path')
            asset=data/'assets'/key
            try: regular(asset)
            except ValueError: raise ValueError('Referenced asset is missing: '+key)
            if asset.stat().st_size!=size or digest(asset)!=sha: raise ValueError('Referenced asset size/hash mismatch: '+key)
    finally: db.close()
    return False

def files(data):
    if data.is_symlink() or not data.is_dir(): raise ValueError('Data directory must be a real directory')
    found={}
    for name in DBFILES:
        p=data/name
        if p.exists(): regular(p);found['data/'+name]=p
    assets=data/'assets'
    if assets.is_symlink(): raise ValueError('Unsafe assets directory')
    if assets.exists():
        for p in assets.iterdir():
            if ASSET.fullmatch(p.name): regular(p);found['data/assets/'+p.name]=p
    return found

def create(data,releasepath):
    data=pathlib.Path(data).absolute();release=release_data(releasepath)
    empty=inspect_data(data,release);payload=files(data)
    manifest={'format':1,'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'empty':empty,'release':release,'files':{name:{'size':p.stat().st_size,'sha256':digest(p)} for name,p in sorted(payload.items())}}
    with tarfile.open(fileobj=sys.stdout.buffer,mode='w|gz') as archive:
        for name,value in [('backup.json',manifest),('release.json',release)]:
            content=json.dumps(value,sort_keys=True).encode();item=tarfile.TarInfo(name);item.size=len(content);item.mode=0o600;archive.addfile(item,io.BytesIO(content))
        for name,p in sorted(payload.items()):
            item=tarfile.TarInfo(name);item.size=p.stat().st_size;item.mode=0o600
            with p.open('rb') as content: archive.addfile(item,content)

def allowed(name):
    return name in {'backup.json','release.json'} or name.startswith('data/') and (name[5:] in DBFILES or name.startswith('data/assets/') and ASSET.fullmatch(name[12:]))

def read_archive(path,target):
    seen=set()
    with tarfile.open(path,'r:gz') as archive:
        for member in archive:
            if not member.isfile() or not allowed(member.name) or member.name in seen: raise ValueError('Unsafe/duplicate backup path or non-regular member')
            seen.add(member.name)
            if member.name in {'backup.json','release.json'} and member.size>8*1024*1024: raise ValueError('Backup metadata exceeds limit')
            destination=target/member.name;destination.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
            with archive.extractfile(member) as source,destination.open('xb') as out: shutil.copyfileobj(source,out,1024*1024)
            destination.chmod(0o600)
    manifest=json.loads((target/'backup.json').read_text());release=json.loads((target/'release.json').read_text())
    if manifest.get('format')!=1 or not isinstance(manifest.get('empty'),bool) or manifest.get('release')!=release or not isinstance(manifest.get('files'),dict): raise ValueError('Invalid backup manifest')
    if set(manifest['files'])!=seen-{'backup.json','release.json'}: raise ValueError('Backup member list mismatch')
    for name,record in manifest['files'].items():
        p=target/name
        if p.stat().st_size!=record['size'] or digest(p)!=record['sha256']: raise ValueError('Backup content checksum mismatch')
    data=target/'data';data.mkdir(exist_ok=True,mode=0o700)
    if inspect_data(data,release)!=manifest['empty']: raise ValueError('Backup database state mismatch')
    return manifest

def verify(path):
    path=pathlib.Path(path);regular(path)
    checksum=pathlib.Path(str(path)+'.sha256').read_text().split()
    if len(checksum)!=2 or checksum[1]!=path.name or not re.fullmatch('[a-f0-9]{64}',checksum[0]) or digest(path)!=checksum[0]: raise ValueError('Backup archive checksum mismatch')
    with tempfile.TemporaryDirectory(prefix='sfbb-verify-') as root: return read_archive(path,pathlib.Path(root))

def main():
    command=sys.argv[1]
    if command=='create': create(sys.argv[2],sys.argv[3])
    elif command=='checksum':
        p=pathlib.Path(sys.argv[2]);pathlib.Path(str(p)+'.sha256').write_text(digest(p)+'  '+p.name+'\n')
    elif command=='promote':
        os.link(sys.argv[2],sys.argv[3]);pathlib.Path(sys.argv[2]).unlink()
    elif command=='verify': print(json.dumps(verify(sys.argv[2]),sort_keys=True))
    elif command=='release':
        m=verify(sys.argv[2])
        if m['empty']: raise ValueError('Empty installation marker cannot restore an application database')
        pathlib.Path(sys.argv[3]).write_text(json.dumps(m['release'])+'\n')
    elif command=='extract':
        target=pathlib.Path(sys.argv[2]);incoming=target/'.incoming.tar.gz'
        with incoming.open('xb') as out: shutil.copyfileobj(sys.stdin.buffer,out,1024*1024)
        m=read_archive(incoming,target);incoming.unlink()
        if m['empty']: raise ValueError('Empty installation marker cannot restore an application database')
        if len(sys.argv)>3:
            owner=int(sys.argv[3])
            for p in [target/'data',*(target/'data').rglob('*')]: os.chown(p,owner,owner)
        print('Restored data validated',file=sys.stderr)
    elif command=='inspect': inspect_data(pathlib.Path(sys.argv[2]),release_data(sys.argv[3]));print('Data validated')
    elif command=='nonempty': print('yes' if any(pathlib.Path(sys.argv[2]).iterdir()) else 'no')
    else: raise ValueError('Unknown backup command')

if __name__=='__main__':
    try: main()
    except (ValueError,KeyError,TypeError,OSError,sqlite3.Error,tarfile.TarError) as error: sys.exit('sfbb: '+str(error))
