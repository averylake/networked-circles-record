// R2.4: records travel as a small head plus fixed pages of 1,000 patrons.
export const VERSION = 'full-field-v2';
export const ADDRESS = /^0x[0-9a-f]{40}$/i;
export const ZERO = '0x'+'0'.repeat(40);
export function address(value) {
  if (typeof value !== 'string' || !ADDRESS.test(value) || value.toLowerCase() === ZERO) throw Error('Invalid wallet address');
  return value.toLowerCase();
}
export function uint(value) {
  if (!/^(0|[1-9][0-9]*)$/.test(String(value))) throw Error('Invalid unsigned integer');
  return BigInt(value).toString();
}
export function place(index, anchors) {
  if (!Number.isSafeInteger(index)||index<0||!anchors.length) throw Error('Invalid place');
  const [x,y,r] = anchors[index % anchors.length];
  const layer = Math.floor(index/anchors.length);
  // Additional places share a local constellation, with distinct coordinates.
  // Previously assigned places never move or get replaced at any population.
  const angle = layer*2.399963229728653;
  const offset = layer ? r*0.42*(1-1/(layer+1)) : 0;
  return {index,x:x+Math.cos(angle)*offset,y:y+Math.sin(angle)*offset,r,
    phase:((index*0.618033988749895)%1)*Math.PI*2, period:5+(index%17)*0.31};
}
export function validateState(raw, config) {
  if (!raw || raw.version!==VERSION || raw.releaseId!==config.releaseId) throw Error('Wrong artwork record');
  if (raw.chainId!==1 || address(raw.collection)!==address(config.collection) || address(raw.edition)!==address(config.edition)) throw Error('Wrong collection record');
  if (!['unbound','waiting','live','closing','sealed'].includes(raw.phase)) throw Error('Unknown field state');
  if (!Array.isArray(raw.patrons)||raw.patrons.length>100000) throw Error('Invalid patron record');
  const seen=new Set();
  const patrons=raw.patrons.map((p,i)=>{
    const wallet=address(p.address);
    if(seen.has(wallet)||p.index!==i) throw Error('Invalid place order');
    seen.add(wallet);
    return {...p,address:wallet,label:typeof p.label==='string'?p.label.slice(0,100):null,
      handle:typeof p.handle==='string'?p.handle.slice(0,80):null};
  });
  if(raw.tokenId!==null) uint(raw.tokenId);
  if(config.tokenId!==null&&config.tokenId!==undefined&&uint(raw.tokenId)!==uint(config.tokenId))throw Error('Wrong token record');
  if(raw.phase==='unbound'&&(raw.tokenId!==null||patrons.length))throw Error('Invalid unbound record');
  if(!raw.simulated&&raw.phase!=='unbound'&&raw.tokenId===null)throw Error('Missing bound token');
  if(config.artifactURI&&raw.artifactURI!==config.artifactURI)throw Error('Wrong media record');
  if(raw.verifiedThrough&&(!Number.isSafeInteger(raw.verifiedThrough.number)||raw.verifiedThrough.number<0||!/^0x[0-9a-f]{64}$/i.test(raw.verifiedThrough.hash)))throw Error('Invalid confirmed block');
  if(!raw.simulated&&['live','closing','sealed'].includes(raw.phase)&&(!raw.auctionId||!raw.endsAt))throw Error('Missing patron window');
  // Confirmed patron fields require all immutable inscription inputs.
  if(raw.auctionStart!==undefined&&raw.auctionStart!==null&&(!Number.isSafeInteger(raw.auctionStart)||raw.auctionStart<1))throw Error('Invalid auction start');
  const HASH=/^0x[0-9a-f]{64}$/i;
  if(!raw.simulated&&patrons.length&&(!Number.isSafeInteger(raw.auctionStart)||raw.auctionStart<1))throw Error('Missing auction clock');
  for(const p of raw.patrons){
    if(!raw.simulated){
      if(!Number.isSafeInteger(p.timestamp)||p.timestamp<1)throw Error('Missing joining time');
      if(!HASH.test(p.transactionHash)||!HASH.test(p.blockHash))throw Error('Missing patron proof');
      for(const k of ['block','logIndex','batchIndex'])if(!Number.isSafeInteger(p[k])||p[k]<0)throw Error('Missing patron event position');
      if(raw.endsAt&&p.timestamp>raw.endsAt)throw Error('Joining time exceeds patron window');
    }
    if(p.timestamp!==undefined&&p.timestamp!==null&&(!Number.isSafeInteger(p.timestamp)||p.timestamp<1||(Number.isSafeInteger(raw.auctionStart)&&p.timestamp<raw.auctionStart)))throw Error('Invalid joining time');
    for(const k of ['transactionHash','blockHash'])if(p[k]!==undefined&&p[k]!==null&&!HASH.test(p[k]))throw Error('Invalid patron proof');
  }
  if(raw.endsAt!==null && (!Number.isSafeInteger(raw.endsAt)||raw.endsAt<1)) throw Error('Invalid closing time');
  return {...raw,patrons};
}
export function findPatron(patrons, input) {
  const q=input.trim().toLowerCase().replace(/^@/,'');
  if(!q)return null;
  if(ADDRESS.test(q))return patrons.find(p=>p.address.toLowerCase()===q)||null;
  const matches=patrons.filter(p=>(p.handle||'').toLowerCase()===q || (p.label||'').toLowerCase()===q);
  if(matches.length>1)throw Error('Several patrons use that name. Please enter the wallet address.');
  return matches[0]||null;
}
