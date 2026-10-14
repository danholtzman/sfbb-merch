import {test,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {randomUUID,scryptSync} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import sharp from 'sharp';
const enabled=process.env.SFBB_CONTAINER_SMOKE==='1', repo=resolve('..');
function docker(args:string[],env:NodeJS.ProcessEnv){const r=spawnSync('docker',args,{encoding:'utf8',env,maxBuffer:4*1024*1024});if(r.status!==0)throw new Error(`Docker ${args[0]} failed: ${r.stderr}`);return r.stdout.trim();}
test.skipIf(!enabled)('ARM64 Compose runtime is read-only/non-root with durable SQLite/assets and loopback health',async()=>{
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
  const inspect=JSON.parse(docker(['inspect',container],env))[0];expect(inspect.HostConfig.PortBindings['3000/tcp'][0].HostIp).toBe('127.0.0.1');expect(readFileSync(join(root,'data/sfbb.sqlite')).length).toBeGreaterThan(0);
 }finally{spawnSync('docker',[...base,'down','--remove-orphans'],{env,encoding:'utf8'});rmSync(root,{recursive:true,force:true});}
},120000);
