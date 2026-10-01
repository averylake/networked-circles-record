import {sha256Hex} from './signature.mjs';
// Shared, testable record transport. A cached JSON record is continuity data,
// not a substitute for independent chain verification of the state service.
export function validateTransition(previous,next){
  if(!previous)return next;
  if(previous.tokenId!==null&&String(previous.tokenId)!==String(next.tokenId))throw Error('Bound token changed');
  if(previous.artifactURI&&previous.artifactURI!==next.artifactURI)throw Error('Bound media changed');
  if(previous.auctionId&&previous.auctionId!==next.auctionId)throw Error('Patron window changed');
  if(previous.auctionStart!=null&&previous.auctionStart!==next.auctionStart)throw Error('Auction clock changed');
  if(previous.phase==='sealed'&&(next.phase!=='sealed'||JSON.stringify(previous.patrons)!==JSON.stringify(next.patrons)))throw Error('Final record changed');
  for(let i=0;i<previous.patrons.length;i++){
    const a=previous.patrons[i],b=next.patrons[i];
    if(a.address!==b?.address)throw Error('Existing patron places changed');
    for(const k of ['timestamp','transactionHash','blockHash','block','logIndex','batchIndex'])
      if(a[k]!==b[k])throw Error('Confirmed patron proof changed');
  }
  if(previous.verifiedThrough&&(!next.verifiedThrough||next.verifiedThrough.number<previous.verifiedThrough.number))throw Error('Confirmed record went backwards');
  if(previous.verifiedThrough&&next.verifiedThrough?.number===previous.verifiedThrough.number&&next.verifiedThrough.hash!==previous.verifiedThrough.hash)throw Error('Confirmed block changed');
  return next;
}
export function refreshDelay(failures=0,random=Math.random){return Math.min(3600000,300000*2**Math.min(failures,4))*(.9+.2*random());}
// Progress of a validated record: sealed beats everything, then the highest
// confirmed block, then the longer roster. Unbound records rank lowest.
export function recordProgress(record){
  return [record.phase==='sealed'?1:0,record.phase==='unbound'?-1:0,record.verifiedThrough?.number??-1,record.patronCount??record.patrons.length];
}
// R2.4 paged transport. A record travels as a small head plus fixed pages of
// PAGE_SIZE patrons, so a viewer downloads the roster once and then polls only
// the head. Every host (service, static backup) uses the same layout:
//   head:  <url>                      pages: <url without .json>/page-<n>.json
export const PAGE_SIZE=1000;
// Digests bind the exact page content, including immutable inscription inputs.
export function pageDigest(page){return sha256Hex(JSON.stringify(page));}
export function pageURL(url,index){return String(url).replace(/\.json$/,'')+'/page-'+index+'.json';}
export function splitRecord(record){
  const {patrons,...rest}=record,pages=[];
  for(let start=0;start<patrons.length;start+=PAGE_SIZE){
    const slice=patrons.slice(start,start+PAGE_SIZE);
    pages.push({version:record.version,releaseId:record.releaseId,page:pages.length,start,patrons:slice});
  }
  const head={...rest,patronCount:patrons.length,pageSize:PAGE_SIZE,pages:pages.map(p=>({count:p.patrons.length,last:p.patrons[p.patrons.length-1].address.toLowerCase(),sha256:pageDigest(p)}))};
  return {head,pages};
}
const ADDRESS_FORMAT=/^0x[0-9a-f]{40}$/i;
export function checkHead(head,config){
  if(!head||typeof head!=='object'||head.releaseId!==config.releaseId||head.chainId!==1)throw Error('Wrong artwork record');
  if(String(head.collection).toLowerCase()!==String(config.collection).toLowerCase()||String(head.edition).toLowerCase()!==String(config.edition).toLowerCase())throw Error('Wrong collection record');
  if(head.pageSize!==PAGE_SIZE||!Array.isArray(head.pages)||!Number.isSafeInteger(head.patronCount)||head.patronCount<0||head.patronCount>100000)throw Error('Invalid record pages');
  let total=0;
  head.pages.forEach((p,i)=>{
    if(!p||!Number.isSafeInteger(p.count)||p.count<1||p.count>PAGE_SIZE||!ADDRESS_FORMAT.test(p.last)||!/^[0-9a-f]{64}$/.test(p.sha256))throw Error('Invalid record pages');
    if(i<head.pages.length-1&&p.count!==PAGE_SIZE)throw Error('Invalid record pages');
    total+=p.count;
  });
  if(total!==head.patronCount)throw Error('Invalid record pages');
  return head;
}
export function checkPage(raw,head,index){
  const meta=head.pages[index],start=index*PAGE_SIZE;
  if(!meta||pageDigest(raw)!==meta.sha256)throw Error('Page content digest mismatch');
  if(!raw||raw.version!==head.version||raw.releaseId!==head.releaseId||raw.page!==index||raw.start!==start||!Array.isArray(raw.patrons)||raw.patrons.length!==meta.count)throw Error('Page does not match record');
  if(String(raw.patrons[raw.patrons.length-1]?.address).toLowerCase()!==meta.last)throw Error('Page does not match record');
  raw.patrons.forEach((p,j)=>{if(p?.index!==start+j)throw Error('Page does not match record');});
  return raw.patrons;
}
export function joinRecord(head,pages){
  const {pages:_meta,patronCount:_count,pageSize:_size,...rest}=head;
  return {...rest,patrons:pages.flat()};
}
async function getJSON(fetcher,url){
  const response=await fetcher(url,{credentials:'omit',cache:'no-cache',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Unavailable');
  return response.json();
}
async function assemble(url,head,validate,fetcher,cache){
  const pages=[],staged=new Map();
  for(let i=0;i<head.pages.length;i++){
    // A digest permits safe reuse across hosts. Never trust count + last wallet.
    const key=JSON.stringify([head.version,head.releaseId,head.chainId,head.collection,head.edition,head.tokenId,i,head.pages[i].sha256]);
    const patrons=cache.has(key)?cache.get(key):checkPage(await getJSON(fetcher,pageURL(url,i)),head,i);
    staged.set(key,patrons);pages.push(patrons);
  }
  // Nothing from a rejected record enters the shared cache. Keep only the
  // winning revision: growing partial pages cannot accumulate indefinitely.
  const record=validate(joinRecord(head,pages));
  cache.clear();for(const [key,page] of staged)cache.set(key,page);
  return record;
}
export async function fetchRecord(urls,validate,fetcher=fetch,{config,cache=new Map()}={}){
  const list=[...new Set(urls.filter(Boolean))],heads=[];
  for(const [position,url] of list.entries()){
    try{
      const head=await getJSON(fetcher,url);
      if(config)checkHead(head,config);else if(!Array.isArray(head?.pages))throw Error('Invalid record pages');
      // A fresh primary record is authoritative: every backup is a copy of it.
      if(position===0&&head.phase!=='unbound'&&!head.stale){
        try{return {record:await assemble(url,head,validate,fetcher,cache),url,primary:true};}catch{/* fall back to comparison */}
      }
      heads.push({head,url,position});
    }catch{/* try the next independent location */}
  }
  // Otherwise keep the most advanced record, so an older backup can never
  // replace a newer (stale-flagged) primary record. Ties favour the primary.
  heads.sort((a,b)=>{const x=recordProgress(a.head),y=recordProgress(b.head);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return y[i]-x[i];return a.position-b.position;});
  for(const {head,url,position} of heads){
    try{return {record:await assemble(url,head,validate,fetcher,cache),url,primary:position===0};}catch{/* next location */}
  }
  throw Error('Patron record unreachable');
}
export function unavailableMessage(state){
  return state?.updatedAt?['Patron updates unavailable','Showing the last confirmed record; participation may have changed.']:
    ['Patron record unreachable','Unassigned prelude. Participation cannot currently be determined.'];
}
// An unbound backup is only a pre-mint snapshot. It cannot prove that nobody
// participated while the primary is unreachable. Keep this notice visible.
export function recordUnavailable(state,{offline=false,viaBackup=false}={}){
  return Boolean(offline||state?.stale||(viaBackup&&state?.phase!=='sealed'));
}
