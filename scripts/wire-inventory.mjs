import fs from 'fs';
const files=process.argv.slice(2);
const pidKeys=new Map(); const pidCount=new Map(); const samples=new Map();
const lobbyKeys=new Map();
function walk(o,s,prefix=''){ if(o===null||typeof o!=='object')return;
  for(const k of Object.keys(o)){ s.add(prefix+k); const v=o[k];
    if(v&&typeof v==='object'&&!Array.isArray(v)) walk(v,s,prefix+k+'.');
    else if(Array.isArray(v)&&v.length&&typeof v[0]==='object') walk(v[0],s,prefix+k+'[].'); } }
let total=0;
for(const f of files){
  for(const ln of fs.readFileSync(f,'utf8').split('\n')){
    if(!ln)continue; let rec; try{rec=JSON.parse(ln)}catch{continue}
    if(rec.kind!=='msg'||typeof rec.data!=='string')continue;
    const bar=rec.data.indexOf('|'); if(bar<0)continue;
    const body=rec.data.slice(bar+1); if(!body.startsWith('{'))continue;
    let j; try{j=JSON.parse(body)}catch{continue}
    total++;
    if(j.data&&j.data.pid){
      const pid=j.data.pid;
      pidCount.set(pid,(pidCount.get(pid)||0)+1);
      if(!pidKeys.has(pid))pidKeys.set(pid,new Set());
      walk(j.data,pidKeys.get(pid));
      const n=Object.keys(j.data).length;
      if(!samples.has(pid)||n>samples.get(pid).n) samples.set(pid,{n,s:JSON.stringify(j.data).slice(0,700)});
    } else {
      for(const k of Object.keys(j)){ if(!lobbyKeys.has(k))lobbyKeys.set(k,new Set()); walk(j[k],lobbyKeys.get(k)); }
    }
  }
}
console.log('game frames parsed:',total,'\n');
const ident=/nick|name|alias|user|screen|avatar|uid|guid|handle|player|account|login|member|cust/i;
console.log('=== GAME PIDs (count) — keys ===');
for(const [pid,c] of [...pidCount.entries()].sort((a,b)=>b[1]-a[1])){
  const ks=[...pidKeys.get(pid)].sort();
  const hits=ks.filter(k=>ident.test(k));
  console.log(`\n${pid}  x${c}`);
  console.log('  '+ks.join(', '));
  if(hits.length)console.log('  >>> IDENTITY-SHAPED: '+hits.join(', '));
}
console.log('\n\n=== LOBBY/OTHER top-level message types ===');
for(const [k,s] of lobbyKeys) console.log(`${k}: ${[...s].sort().join(', ')}`);
