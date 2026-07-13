// Exact integral Apollonian packing engine.
// Circles are represented by signed bend coordinates (b,bx,by).

export function reflect(config,i){
  const out=config.map(c=>({...c}));
  let b=0n,bx=0n,by=0n;
  for(let j=0;j<4;j++) if(j!==i){b+=config[j].b;bx+=config[j].bx;by+=config[j].by;}
  out[i]={b:2n*b-config[i].b,bx:2n*bx-config[i].bx,by:2n*by-config[i].by};
  return out;
}

export function initialConfiguration(){
 return [
  {b:-1n,bx:0n,by:0n},
  {b:2n,bx:-1n,by:0n},
  {b:2n,bx:1n,by:0n},
  {b:2n,bx:0n,by:2n}
 ];
}

export function circle(c){
 return {x:Number(c.bx)/Number(c.b),y:Number(c.by)/Number(c.b),r:1/Math.abs(Number(c.b))};
}

export function generate(config,depth){
 const result=[],seen=new Set();
 function add(c){const k=`${c.b},${c.bx},${c.by}`;if(!seen.has(k)){seen.add(k);result.push(circle(c));}}
 function walk(q,n){q.forEach(add);if(n>0)for(let i=0;i<4;i++)walk(reflect(q,i),n-1);}
 walk(config,depth);return result;
}
