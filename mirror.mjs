// Copies only validated public records. No wallet or RPC credentials are used.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {validateState} from './lib/model.mjs';
import {validateTransition,fetchRecord} from './lib/records.mjs';
import {readLocal,writeLocal} from './store.mjs';

export function validatePrevious(raw,config){
  // The sole permitted migration is the pristine pre-mint snapshot becoming
  // bound to the verified configuration. Never relax checks on a bound record.
  if(config.tokenId!==null&&raw.phase==='unbound'){
    const previous=validateState(raw,{...config,tokenId:null,artifactURI:null});
    if(previous.simulated||previous.stale||previous.tokenId!==null||previous.patrons.length||
      ['artifactURI','auctionId','endsAt','windowProof','verifiedThrough','sealedAt','updatedAt','auctionStart'].some(k=>previous[k]!=null)){
      throw Error('Only a pristine unbound record may migrate');
    }
    return previous;
  }
  return validateState(raw,config);
}

export async function mirror({root=new URL('./',import.meta.url),fetcher=fetch}={}){
  const config=JSON.parse(await fs.readFile(new URL('release-config.json',root),'utf8'));
  if(config.tokenId!==null&&(!config.artifactURI?.startsWith('ipfs://')||!Number.isSafeInteger(config.mintBlock)||config.mintBlock<1))throw Error('Verified mint binding required');
  const stored=await readLocal(root);
  const previous=stored?validatePrevious(stored,config):null;
  if(previous?.simulated||previous?.stale)throw Error('Invalid existing archive');
  if(previous?.phase==='sealed')return 'Sealed record retained. No upstream request.';
  let record;
  try{({record}=await fetchRecord([config.serviceURL],raw=>validateState(raw,config),fetcher,{config}));}
  catch{throw Error('Primary unavailable; existing backup retained');}
  if(record.simulated||record.stale)throw Error('Unconfirmed record; existing backup retained');
  if(config.tokenId===null&&record.phase!=='unbound')throw Error('Apply the verified mint binding before archiving a bound record');
  validateTransition(previous,record);
  // Retain confirmed-block progress as well as roster changes. Timestamps alone
  // do not cause commits, but a newer proof must not be discarded by the mirror.
  const fingerprint=r=>JSON.stringify([r.tokenId,r.artifactURI,r.auctionId,r.auctionStart,r.phase,r.endsAt,r.patrons,r.verifiedThrough]);
  if(previous&&fingerprint(previous)===fingerprint(record))return 'No material change.';
  await writeLocal(root,record);
  return 'Validated public record copied locally.';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(await mirror());
