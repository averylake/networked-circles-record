import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {pageURL} from './lib/records.mjs';
import {readLocal,localFiles} from './store.mjs';
export async function verifyPublished(url,expected,{fetcher=fetch,attempts=12,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
  if(!url||!/^https:\/\//.test(url))throw Error('HTTPS Pages record URL required');
  const hash=b=>createHash('sha256').update(b).digest('hex'),wanted=hash(expected);
  let failure;
  for(let attempt=0;attempt<attempts;attempt++){
    try{
      const response=await fetcher(url,{headers:{Origin:'null','Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
      if(!response.ok||response.headers.get('access-control-allow-origin')!=='*')throw Error('Pages response or opaque-origin CORS failed');
      if(hash(Buffer.from(await response.arrayBuffer()))!==wanted)throw Error('Published record does not match committed bytes');
      return wanted;
    }catch(e){failure=e;if(attempt+1<attempts)await sleep(10000);}
  }
  throw failure;
}
// Head and every page must be served byte-for-byte with opaque-origin CORS.
export async function verifyRecordPublished(url,root,options){
  const record=await readLocal(root);if(!record)throw Error('No local record');
  const files=localFiles(record),hashes=[];
  for(const [i,file] of files.entries())hashes.push(await verifyPublished(i===0?url:pageURL(url,i-1),await fs.readFile(new URL(file,root)),options));
  return hashes;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const root=new URL('./',import.meta.url),config=JSON.parse(await fs.readFile(new URL('release-config.json',root),'utf8'));
  const hashes=await verifyRecordPublished(config.backupURLs[0],root);
  console.log('Public record verified: '+hashes.length+' files, head '+hashes[0]);
}
