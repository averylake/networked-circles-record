import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {validateState} from './lib/model.mjs';
import {readLocal,localFiles} from './store.mjs';
export async function preparePages(root=new URL('./',import.meta.url)){
  const config=JSON.parse(await fs.readFile(new URL('release-config.json',root),'utf8'));
  const stored=await readLocal(root);if(!stored)throw Error('No local record');
  const record=validateState(stored,config);
  if(record.simulated||record.stale)throw Error('Cannot publish unconfirmed record');
  // Only the public head and pages are deployed, never configuration, scripts or secrets.
  const site=new URL('_site/',root);
  await fs.mkdir(new URL('full-field-v1/',site),{recursive:true});
  const unexpected=(await fs.readdir(site)).filter(n=>!['full-field-v1.json','full-field-v1','.nojekyll'].includes(n));
  if(unexpected.length)throw Error('Unexpected Pages files: '+unexpected.join(', '));
  for(const file of localFiles(record))await fs.writeFile(new URL(file,site),await fs.readFile(new URL(file,root)));
  await fs.writeFile(new URL('.nojekyll',site),'');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await preparePages();
