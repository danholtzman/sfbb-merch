#!/usr/bin/env python3
"""Release metadata/checksum validation; never execute archive content."""
import hashlib,json,pathlib,re,subprocess,sys

def digest(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''): h.update(block)
    return h.hexdigest()

def inspect(name):
    return json.loads(subprocess.check_output(['docker','image','inspect',name]))[0]

def validate(archive,tag):
    path=pathlib.Path(archive)
    expected=f'sfbb-merch-{tag}.tar'
    if path.name!=expected: raise ValueError('archive filename does not match release tag')
    checksum=pathlib.Path(str(path)+'.sha256').read_text().strip().split()
    if len(checksum)!=2 or checksum[1]!=expected or not re.fullmatch('[a-f0-9]{64}',checksum[0]) or digest(path)!=checksum[0]: raise ValueError('archive checksum mismatch')
    m=json.loads(pathlib.Path(str(path)+'.manifest.json').read_text())
    if (m['format']!=1 or m['releaseTag']!=tag or not re.fullmatch('[a-f0-9]{40}',m['commit']) or not m['commit'].startswith(tag) or m['platform']!='linux/arm64' or not re.fullmatch(r'v24\.\d+\.\d+',m['node']) or m['archive']!=expected or m['sha256']!=checksum[0] or not isinstance(m['migrations'],list) or not m['migrations'] or any(not re.fullmatch(r'\d{14}_[A-Za-z0-9_]+',x) for x in m['migrations'])): raise ValueError('invalid release manifest')
    for key,prefix in [('app','sfbb-merch'),('migrate','sfbb-merch-migrate')]:
        image=m['images'][key]
        if image['name']!=f'{prefix}:{tag}' or not re.fullmatch('sha256:[a-f0-9]{64}',image['id']): raise ValueError('manifest image pair mismatch')
    return m

try:
    mode=sys.argv[1]
    if mode=='verify': validate(sys.argv[2],sys.argv[3])
    elif mode=='images':
        m=json.loads(pathlib.Path(sys.argv[2]).read_text())
        for image in m['images'].values():
            actual=inspect(image['name'])
            if (actual['Id']!=image['id'] or actual['Architecture']!='arm64' or actual['Os']!='linux' or actual['Config']['Labels'].get('org.opencontainers.image.revision')!=m['commit']): raise ValueError('loaded image identity/platform/commit mismatch')
    elif mode=='create':
        archive,tag,commit,source=sys.argv[2:6]
        images={key:{'name':f'{prefix}:{tag}','id':inspect(f'{prefix}:{tag}')['Id']} for key,prefix in [('app','sfbb-merch'),('migrate','sfbb-merch-migrate')]}
        node=subprocess.check_output(['docker','run','--rm','--entrypoint','node',images['app']['name'],'--version'],text=True).strip()
        sha=digest(archive)
        m={'format':1,'releaseTag':tag,'commit':commit,'platform':'linux/arm64','node':node,'archive':pathlib.Path(archive).name,'sha256':sha,'images':images,'migrations':sorted(p.name for p in pathlib.Path(source,'web/prisma/migrations').iterdir() if p.is_dir())}
        pathlib.Path(archive+'.sha256').write_text(f'{sha}  {m["archive"]}\n')
        pathlib.Path(archive+'.manifest.json').write_text(json.dumps(m,indent=2)+'\n')
        validate(archive,tag)
    else: raise ValueError('unknown release command')
except (ValueError,KeyError,TypeError,OSError,subprocess.CalledProcessError) as error:
    sys.exit('sfbb: '+str(error))
