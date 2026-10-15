import {mkdirSync,rmdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
// Both opt-in suites use the real loopback port 3000. Serialize across workers.
export async function dockerSmokeLock(){const path=join(tmpdir(),'sfbb-container-smoke-port3000.lock'),until=Date.now()+180000;while(true){try{mkdirSync(path,{mode:0o700});return()=>rmdirSync(path);}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;if(Date.now()>until)throw new Error('Docker smoke lock timed out; inspect test containers before clearing a stale lock.');await new Promise(resolve=>setTimeout(resolve,500));}}}
