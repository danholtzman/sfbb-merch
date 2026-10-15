import {test,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync,cpSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {randomUUID,scryptSync} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import sharp from 'sharp';
import {dockerSmokeLock} from '../docker-smoke-lock';
const enabled=process.env.SFBB_CONTAINER_SMOKE==='1', repo=resolve('..');
function docker(args:string[],env:NodeJS.ProcessEnv){const r=spawnSync('docker',args,{encoding:'utf8',env,maxBuffer:4*1024*1024});if(r.status!==0)throw new Error(`Docker ${args[0]} failed: ${r.stderr}`);return r.stdout.trim();}
// Retained data belongs to UID 10001; Linux operators cannot inspect it directly.
const retainedProbe="import sqlite3,sys,pathlib;print(any(sqlite3.connect(p.as_uri()+'?mode=ro',uri=True).execute(\"SELECT count(*) FROM _prisma_migrations WHERE migration_name='202610150001_candidate'\").fetchone()[0] for p in pathlib.Path(sys.argv[1]).glob('.previous-data-*/sfbb.sqlite')))";
test.skipIf(!enabled)('retained-data inspection works with actual Linux UID permissions',()=>{
 const tag=process.env.SFBB_SMOKE_TAG ?? 'stage11-smoke';
 const fixture=`import os,sqlite3,pathlib,subprocess,sys
root=pathlib.Path('/tmp/retained-fixture');root.mkdir(mode=0o755)
data=root/'.previous-data-fixture';data.mkdir(mode=0o700)
path=data/'sfbb.sqlite';db=sqlite3.connect(path)
db.execute('CREATE TABLE _prisma_migrations(migration_name TEXT)')
db.execute("INSERT INTO _prisma_migrations VALUES ('202610150001_candidate')")
db.commit();db.close();path.chmod(0o600);os.chown(data,10001,10001);os.chown(path,10001,10001)
pid=os.fork()
if pid==0:
 os.setgid(1000);os.setuid(1000)
 try: sqlite3.connect(path.as_uri()+'?mode=ro',uri=True);os._exit(2)
 except sqlite3.OperationalError: os._exit(0)
_,status=os.waitpid(pid,0)
assert os.waitstatus_to_exitcode(status)==0, 'Fixture did not reproduce denied host inspection'
result=subprocess.run([sys.executable,'-c',sys.argv[1],str(root)],capture_output=True,text=True,check=True)
print(result.stdout.strip())`;
 expect(docker(['run','--rm','--read-only','--network','none','--user','0:0','--cap-drop','ALL','--cap-add','CHOWN','--cap-add','SETUID','--cap-add','SETGID','--cap-add','DAC_OVERRIDE','--tmpfs','/tmp:rw','--entrypoint','python3',`sfbb-merch-migrate:${tag}`,'-c',fixture,retainedProbe],process.env)).toBe('True');
},30000);
test.skipIf(!enabled).each(['incomplete','completed'] as const)('ARM64 runtime and paired recovery after a %s migration',async(migrationState)=>{
 const unlock=await dockerSmokeLock();
 const root=mkdtempSync(join(tmpdir(),'sfbb-runtime-')),project='sfbb-smoke-'+randomUUID().slice(0,8),tag=process.env.SFBB_SMOKE_TAG ?? 'stage11-smoke';
 const hash=(password:string)=>{const salt='1'.repeat(32);return `scrypt:${salt}:${scryptSync(password,Buffer.from(salt,'hex'),64).toString('hex')}`;};
 mkdirSync(join(root,'data'));writeFileSync(join(root,'.env'),`MEMBER_PASSWORD_HASH=${hash('Member smoke test')}\nADMIN_PASSWORD_HASH=${hash('Admin smoke test')}\nSESSION_SECRET=${randomUUID().repeat(3)}\nSESSION_TTL_SECONDS=43200\n`,{mode:0o600});
 const env={...process.env,SFBB_ROOT:root,SFBB_RELEASE_TAG:tag},base=['compose','-p',project,'--profile','maintenance','-f',join(repo,'deploy/compose.yaml')];
 const compose=(...args:string[])=>docker([...base,...args],env);
 let container='';
 try{
  const config=JSON.parse(compose('config','--format','json')), app=config.services.app;
  expect(app.read_only).toBe(true);expect(app.user).toBe('10001:10001');expect(app.ports[0].host_ip).toBe('127.0.0.1');expect(app.ports[0].published).toBe('3000');expect(config.services.migrate.ports).toBeUndefined();
  docker(['run','--rm','--user','0:0','--entrypoint','chown','--mount',`type=bind,src=${root}/data,dst=/data`,`sfbb-merch:${tag}`,'10001:10001','/data'],env);
  compose('run','--rm','--no-deps','migrate');compose('up','-d','--no-deps','--wait','--wait-timeout','90','app');container=compose('ps','-q','app');
  const meta=JSON.parse(docker(['exec',container,'node','-e',`const fs=require('fs');let readonly=false;try{fs.writeFileSync('/app/root-probe','x')}catch(e){readonly=e.code==='EROFS'}const db=new(require('better-sqlite3'))('/data/sfbb.sqlite');db.exec('CREATE TABLE smoke_probe(value TEXT)');db.prepare('INSERT INTO smoke_probe VALUES (?)').run('persisted');console.log(JSON.stringify({arch:process.arch,uid:process.getuid(),readonly,value:db.prepare('SELECT value FROM smoke_probe').get().value,cli:fs.existsSync('/app/node_modules/prisma'),test:fs.existsSync('/app/node_modules/vitest')}));db.close();`],env));
  expect(meta).toEqual({arch:'arm64',uid:10001,readonly:true,value:'persisted',cli:false,test:false});
  const origin='https://sfbb.holtzman.io',url='http://127.0.0.1:3000';expect((await fetch(url+'/api/health')).ok).toBe(true);
  const login=await fetch(url+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'Admin smoke test'})});expect(login.status).toBe(200);const cookie=login.headers.get('set-cookie')!.split(';')[0],csrf=(await login.json()).data.csrfToken,headers={Origin:origin,Cookie:cookie,'X-CSRF-Token':csrf};
  const created=await fetch(url+'/api/admin/seasons',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({name:'Container smoke',opensOn:'2026-10-14',closesOn:'2026-10-14',announcement:'',copyFromSeasonId:null,reuseArtwork:false})});expect(created.status).toBe(200);const season=(await created.json()).data,catalog=(await(await fetch(url+`/api/admin/seasons/${season.id}/catalog`,{headers})).json()).data,set=catalog.artworkSets[0];
  const png=await sharp({create:{width:10,height:12,channels:4,background:{r:10,g:20,b:30,alpha:.5}}}).png().toBuffer(),form=new FormData();form.append('expectedVersion',String(set.version));form.append('file',new Blob([new Uint8Array(png)],{type:'image/png'}),'front.png');const uploaded=await fetch(url+`/api/admin/artwork-sets/${set.id}/front`,{method:'POST',headers,body:form});expect(uploaded.status).toBe(200);const asset=(await uploaded.json()).data.frontAssetId;
  const before=await fetch(url+`/api/assets/${asset}`,{headers:{Cookie:cookie}});expect(before.status).toBe(200);const bytes=Buffer.from(await before.arrayBuffer());expect((await sharp(bytes).metadata()).hasAlpha).toBe(true);
  compose('restart','app');compose('up','-d','--no-deps','--wait','--wait-timeout','90','app');let after:Response | undefined;await expect.poll(async()=>{try{after=await fetch(url+`/api/assets/${asset}`,{headers:{Cookie:cookie,Connection:'close'}});return after.status;}catch{return 0;}},{timeout:10000}).toBe(200);expect(Buffer.from(await after!.arrayBuffer())).toEqual(bytes);expect(docker(['exec',container,'node','-e',`const db=new(require('better-sqlite3'))('/data/sfbb.sqlite');console.log(db.prepare('SELECT value FROM smoke_probe').get().value);db.close()`],env)).toBe('persisted');
  if(process.env.SFBB_BACKUP_SMOKE==='1'){
   cpSync(join(repo,'scripts'),join(root,'scripts'),{recursive:true});cpSync(join(repo,'deploy'),join(root,'deploy'),{recursive:true});
   const manifest=process.env.SFBB_SMOKE_MANIFEST ?? join(repo,`releases/${tag}/sfbb-merch-${tag}.tar.manifest.json`);cpSync(manifest,join(root,'active-release.json'));
   const operations={...env,SFBB_COMPOSE_PROJECT:project};const run=(name:string,args:string[])=>spawnSync('bash',[join(root,'scripts',name),...args],{env:operations,encoding:'utf8',timeout:120000});
   const backed=run('backup.sh',[join(root,'backups')]);expect(backed.status,backed.stderr).toBe(0);const archive=join(root,'backups',readdirSync(join(root,'backups')).find(n=>n.endsWith('.tar.gz'))!);expect(run('verify-backup.sh',[archive]).status).toBe(0);
   container=compose('ps','-q','app');docker(['exec',container,'node','-e',`const db=new(require('better-sqlite3'))('/data/sfbb.sqlite');db.prepare('UPDATE smoke_probe SET value=?').run('changed');db.close()`],env);
   const refused=run('restore.sh',[archive,tag]);expect(refused.status).not.toBe(0);expect(refused.stderr).toContain('replace-existing');
   const wrong=run('restore.sh',[archive,'deadbeef0000','--replace-existing']);expect(wrong.status).not.toBe(0);expect(wrong.stderr).toContain('release');
   const denied=join(root,'denied-restore');mkdirSync(denied);const failedWrite=spawnSync('docker',['run','--rm','-i','--read-only','--network','none','--user','0:0','--mount',`type=bind,src=${root}/scripts/lib,dst=/ops,readonly`,'--mount',`type=bind,src=${denied},dst=/restore,readonly`,'--entrypoint','python3',`sfbb-merch-migrate:${tag}`,'/ops/backup.py','extract','/restore','10001'],{input:readFileSync(archive),env});expect(failedWrite.status).not.toBe(0);expect(failedWrite.stderr.toString()).toContain('Read-only file system');expect(run('verify-backup.sh',[archive]).status).toBe(0);
   const restored=run('restore.sh',[archive,tag,'--replace-existing']);expect(restored.status,restored.stderr).toBe(0);container=compose('ps','-q','app');expect(docker(['exec',container,'node','-e',`const db=new(require('better-sqlite3'))('/data/sfbb.sqlite');console.log(db.prepare('SELECT value FROM smoke_probe').get().value);db.close()`],env)).toBe('persisted');
   await expect.poll(async()=>{try{return(await fetch(url+`/api/assets/${asset}`,{headers:{Cookie:cookie,Connection:'close'}})).status}catch{return 0;}},{timeout:10000}).toBe(200);expect(readdirSync(join(root,'backups')).filter(n=>n.endsWith('.tar.gz')).length).toBeGreaterThanOrEqual(2);expect(readdirSync(root).some(n=>n.startsWith('.previous-data-'))).toBe(true);
  }
  if(process.env.SFBB_BACKUP_SMOKE==='1'){
   const archive=join(root,'backups',readdirSync(join(root,'backups')).find(n=>n.endsWith('.tar.gz'))!),operations={...env,SFBB_COMPOSE_PROJECT:project};
   const run=(args:string[])=>spawnSync('bash',[join(root,'scripts/restore.sh'),...args],{env:operations,encoding:'utf8',timeout:120000});
   compose('stop','app');
   // This changes the actual deployed SQLite file, unlike an invalid target URL.
   const sql="import sqlite3;db=sqlite3.connect('/data/sfbb.sqlite');db.execute('ALTER TABLE smoke_probe ADD COLUMN failed_change TEXT');db.execute(\"INSERT INTO _prisma_migrations(id,checksum,migration_name,started_at,finished_at,applied_steps_count) VALUES ('recovery-fixture','fixture','202610150001_candidate',CURRENT_TIMESTAMP,?,1)\",("+(migrationState==='completed'?"'2026-10-15T00:00:00Z'":"None")+",));db.commit();db.close()";
   compose('run','--rm','--no-deps','-T','--entrypoint','python3','migrate','-c',sql);
   const ordinary=run([archive,tag,'--replace-existing']);expect(ordinary.status).not.toBe(0);expect(ordinary.stderr).toContain('migration');expect(compose('ps','--status','running','-q','app')).toBe('');
   const recovered=run([archive,tag,'--replace-existing','--quarantine-unverified-current']);expect(recovered.status,recovered.stderr).toBe(0);
   container=compose('ps','-q','app');const result=JSON.parse(docker(['exec',container,'node','-e',`const db=new(require('better-sqlite3'))('/data/sfbb.sqlite');console.log(JSON.stringify({value:db.prepare('SELECT value FROM smoke_probe').get().value,columns:db.prepare('PRAGMA table_info(smoke_probe)').all().map(x=>x.name),migrations:db.prepare('SELECT migration_name FROM _prisma_migrations').all().map(x=>x.migration_name)}));db.close()`],env));
   expect(result.value).toBe('persisted');expect(result.columns).toEqual(['value']);expect(result.migrations).not.toContain('202610150001_candidate');
   expect((await fetch(url+`/api/assets/${asset}`,{headers:{Cookie:cookie,Connection:'close'}})).status).toBe(200);expect(JSON.parse(readFileSync(join(root,'active-release.json'),'utf8')).releaseTag).toBe(tag);
   const retained=docker(['run','--rm','--read-only','--network','none','--user','0:0','--cap-drop','ALL','--cap-add','DAC_OVERRIDE','--mount',`type=bind,src=${root},dst=/inspection,readonly`,'--entrypoint','python3',`sfbb-merch-migrate:${tag}`,'-c',retainedProbe,'/inspection'],env);expect(retained).toBe('True');expect(run([archive,tag,'--quarantine-unverified-current']).status).not.toBe(0);
  }
  const inspect=JSON.parse(docker(['inspect',container],env))[0];expect(inspect.HostConfig.PortBindings['3000/tcp'][0].HostIp).toBe('127.0.0.1');expect(Number(docker(['exec',container,'node','-e',"console.log(require('fs').statSync('/data/sfbb.sqlite').size)"],env))).toBeGreaterThan(0);
 }finally{spawnSync('docker',[...base,'down','--remove-orphans'],{env,encoding:'utf8'});spawnSync('docker',['run','--rm','--read-only','--network','none','--user','0:0','--cap-drop','ALL','--cap-add','DAC_OVERRIDE','--mount',`type=bind,src=${root},dst=/cleanup`,'--entrypoint','python3',`sfbb-merch-migrate:${tag}`,'-c',"import pathlib,shutil;p=pathlib.Path('/cleanup');[(shutil.rmtree(c) if c.is_dir() and not c.is_symlink() else c.unlink()) for c in p.iterdir()]"],{env,encoding:'utf8'});rmSync(root,{recursive:true,force:true});unlock();}
},300000);
