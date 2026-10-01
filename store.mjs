// R2.4 on-disk layout, identical to the published layout:
//   full-field-v1.json            head (identity, phase, page index)
//   full-field-v1/page-<n>.json   1,000 patrons per page
import fs from 'node:fs/promises';
import {splitRecord,joinRecord,checkPage} from './lib/records.mjs';
export const HEAD='full-field-v1.json',PAGES='full-field-v1/';
export async function readLocal(root){
  let head;
  try{head=JSON.parse(await fs.readFile(new URL(HEAD,root),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}
  if(!Array.isArray(head.pages))throw Error('Local head has no page index');
  const pages=[];
  for(let i=0;i<head.pages.length;i++)pages.push(checkPage(JSON.parse(await fs.readFile(new URL(PAGES+'page-'+i+'.json',root),'utf8')),head,i));
  return joinRecord(head,pages);
}
export function localFiles(record){
  const {pages}=splitRecord(record);
  return [HEAD,...pages.map((_,i)=>PAGES+'page-'+i+'.json')];
}
export async function writeLocal(root,record){
  const {head,pages}=splitRecord(record);
  await fs.mkdir(new URL(PAGES,root),{recursive:true});
  // Pages first, head last: a reader never sees a head pointing to missing pages.
  for(const [i,page] of pages.entries()){
    const target=new URL(PAGES+'page-'+i+'.json',root),json=JSON.stringify(page,null,1)+'\n';
    let current=null;try{current=await fs.readFile(target,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
    if(current===json)continue;
    const temporary=new URL(PAGES+'page-'+i+'.json.tmp',root);await fs.writeFile(temporary,json);await fs.rename(temporary,target);
  }
  const temporary=new URL(HEAD+'.tmp',root);
  await fs.writeFile(temporary,JSON.stringify(head,null,2)+'\n');await fs.rename(temporary,new URL(HEAD,root));
}
