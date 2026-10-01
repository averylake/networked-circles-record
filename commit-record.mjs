import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {validateState} from './lib/model.mjs';
import {readLocal,localFiles} from './store.mjs';
export async function commitRecord(root=new URL('./',import.meta.url),now=Date.now()){
  const cwd=fileURLToPath(root),git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
  const config=JSON.parse(await fs.readFile(new URL('release-config.json',root),'utf8'));
  const stored=await readLocal(root);if(!stored)throw Error('No local record');
  const record=validateState(stored,config);
  if(record.stale||record.simulated)throw Error('Cannot commit unconfirmed record');
  if(record.phase!=='sealed'&&now/1000-Number(git('log','-1','--format=%ct'))>2592000){
    await fs.writeFile(new URL('heartbeat.txt',root),new Date(now).toISOString()+'\n');
  }
  git('add','--',...localFiles(record));
  try{await fs.access(new URL('heartbeat.txt',root));git('add','--','heartbeat.txt');}
  catch(e){if(e.code!=='ENOENT')throw e;}
  // The fresh CI checkout contains only these staged changes. Never hide a git
  // failure or stage unrelated files using `git add .`.
  if(!git('diff','--cached','--name-only'))return false;
  git('commit','-m','Preserve confirmed patron record');
  return true;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(await commitRecord()?'Record committed.':'No commit needed.');
