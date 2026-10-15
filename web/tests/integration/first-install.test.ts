import {test,expect} from 'vitest';
import {mkdtempSync,mkdirSync,cpSync,writeFileSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID,scryptSync} from 'node:crypto';
import {dockerSmokeLock} from '../docker-smoke-lock';
const enabled=process.env.SFBB_FIRST_INSTALL_SMOKE==='1';
test.skipIf(!enabled)('cold first install loads its maintenance image, backs up empty data, migrates and starts privately',async()=>{
 const unlock=await dockerSmokeLock();
 const repo=resolve('..'),root=mkdtempSync(join(tmpdir(),'sfbb-first-')),sourceTag=process.env.SFBB_SMOKE_TAG ?? '79a47b0269c6',project='sfbb-first-'+randomUUID().slice(0,8),sourceManifest=process.env.SFBB_SMOKE_MANIFEST ?? join(repo,`releases/${sourceTag}/sfbb-merch-${sourceTag}.tar.manifest.json`),source=JSON.parse(readFileSync(sourceManifest,'utf8'));
 const env:NodeJS.ProcessEnv={...process.env,SFBB_ROOT:root,SFBB_COMPOSE_PROJECT:project};let tag='';
 const docker=(args:string[])=>{const r=spawnSync('docker',args,{env,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});expect(r.status,r.stderr).toBe(0);return r.stdout.trim();};
 try{
  cpSync(join(repo,'scripts'),join(root,'scripts'),{recursive:true});cpSync(join(repo,'deploy'),join(root,'deploy'),{recursive:true});mkdirSync(join(root,'data'));
  const salt='2'.repeat(32),hash='scrypt:'+salt+':'+scryptSync('Disposable acceptance password',Buffer.from(salt,'hex'),64).toString('hex');writeFileSync(join(root,'.env'),`MEMBER_PASSWORD_HASH=${hash}\nADMIN_PASSWORD_HASH=${hash}\nSESSION_SECRET=${randomUUID().repeat(3)}\n`,{mode:0o600});
  docker(['run','--rm','--user','0:0','--entrypoint','chown','--mount',`type=bind,src=${root}/data,dst=/data`,`sfbb-merch:${sourceTag}`,'10001:10001','/data']);
  tag=[20,24,28,32,36,40].map(n=>source.commit.slice(0,n)).find(candidate=>spawnSync('docker',['image','inspect',`sfbb-merch:${candidate}`],{env,stdio:'ignore'}).status!==0)!;expect(tag).toBeTruthy();env.SFBB_RELEASE_TAG=tag;
  docker(['tag',source.images.app.name,`sfbb-merch:${tag}`]);docker(['tag',source.images.migrate.name,`sfbb-merch-migrate:${tag}`]);const archive=join(root,`sfbb-merch-${tag}.tar`);docker(['image','save','--output',archive,`sfbb-merch:${tag}`,`sfbb-merch-migrate:${tag}`]);
  const created=spawnSync('python3',[join(repo,'scripts/lib/release.py'),'create',archive,tag,source.commit,repo],{env,encoding:'utf8'});expect(created.status,created.stderr).toBe(0);docker(['image','rm',`sfbb-merch:${tag}`,`sfbb-merch-migrate:${tag}`]);expect(spawnSync('docker',['image','inspect',`sfbb-merch-migrate:${tag}`],{env,stdio:'ignore'}).status).not.toBe(0);
  const installed=spawnSync('bash',[join(root,'scripts/deploy-release.sh'),archive,tag],{env,encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});expect(installed.status,installed.stderr).toBe(0);expect(JSON.parse(readFileSync(join(root,'active-release.json'),'utf8')).commit).toBe(source.commit);const backup=readdirSync(join(root,'backups')).find(n=>n.endsWith('.manifest.json'))!;expect(JSON.parse(readFileSync(join(root,'backups',backup),'utf8')).empty).toBe(true);const cid=docker(['compose','-p',project,'-f',join(root,'deploy/compose.yaml'),'ps','-q','app']);expect(JSON.parse(docker(['inspect',cid]))[0].HostConfig.PortBindings['3000/tcp'][0].HostIp).toBe('127.0.0.1');
  // Rehearse an actual Prisma migration failure on a read-only runtime path.
  const composePath=join(root,'deploy/compose.yaml'),originalCompose=readFileSync(composePath,'utf8'),activeBefore=readFileSync(join(root,'active-release.json'),'utf8');
  writeFileSync(composePath,originalCompose.replace('  migrate:\n','  migrate:\n    environment:\n      DATABASE_URL: file:/app/denied.sqlite\n'));
  const failed=spawnSync('bash',[join(root,'scripts/deploy-release.sh'),archive,tag],{env,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  expect(failed.status).not.toBe(0);expect(failed.stderr).toContain('Migration failed; app remains stopped');expect(readFileSync(join(root,'active-release.json'),'utf8')).toBe(activeBefore);
  expect(docker(['compose','-p',project,'-f',composePath,'ps','--status','running','-q','app'])).toBe('');
  const recoverable=readdirSync(join(root,'backups')).filter(n=>n.endsWith('.manifest.json')).map(n=>JSON.parse(readFileSync(join(root,'backups',n),'utf8')));expect(recoverable.some(m=>!m.empty&&m.release.commit===source.commit)).toBe(true);
  writeFileSync(composePath,originalCompose);
 }finally{
  if(tag){spawnSync('docker',['compose','-p',project,'-f',join(root,'deploy/compose.yaml'),'down','--remove-orphans'],{env:{...env,SFBB_RELEASE_TAG:tag},encoding:'utf8'});spawnSync('docker',['image','rm',`sfbb-merch:${tag}`,`sfbb-merch-migrate:${tag}`],{env,encoding:'utf8'});}
  spawnSync('docker',['run','--rm','--read-only','--network','none','--user','0:0','--cap-drop','ALL','--cap-add','DAC_OVERRIDE','--mount',`type=bind,src=${root},dst=/cleanup`,'--entrypoint','python3',`sfbb-merch-migrate:${sourceTag}`,'-c',"import pathlib,shutil;p=pathlib.Path('/cleanup');[(shutil.rmtree(c) if c.is_dir() and not c.is_symlink() else c.unlink()) for c in p.iterdir()]"],{env,encoding:'utf8'});rmSync(root,{recursive:true,force:true});unlock();
 }
},240000);
