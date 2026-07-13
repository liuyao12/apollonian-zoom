// Exact integral Apollonian packing engine.
// State is stored exactly as (b,bx,by). Rendering converts later.

export function reflect(config,i){
  const out=config.map(c=>({...c}));
  let b=0n,bx=0n,by=0n;
  for(let j=0;j<4;j++) if(j!==i){
    b+=config[j].b; bx+=config[j].bx; by+=config[j].by;
  }
  out[i]={b:2n*b-config[i].b,bx:2n*bx-config[i].bx,by:2n*by-config[i].by};
  return out;
}

export function circle(c){return {b:c.b,bx:c.bx,by:c.by};}

export function toFloat(c){return {x:Number(c.bx)/Number(c.b),y:Number(c.by)/Number(c.b),r:1/Math.abs(Number(c.b)),b:c.b};}

export function generate(config,depth){
  const result=[],seen=new Set();
  function add(c){const k=`${c.b},${c.bx},${c.by}`;if(!seen.has(k)){seen.add(k);result.push(circle(c));}}
  function walk(q,n){q.forEach(add);if(n>0)for(let i=0;i<4;i++)walk(reflect(q,i),n-1);}
  walk(config,depth);return result;
}

function visible(c,v,margin){
  const x=toFloat(c);
  return !(x.x+x.r<v.left-margin||x.x-x.r>v.right+margin||x.y+x.r<v.bottom-margin||x.y-x.r>v.top+margin);
}

export function generateVisible(config,viewport,scale){
  const result=[],seen=new Set();let count=0;
  function add(c){
    if(!visible(c,viewport,20/scale))return;
    const k=`${c.b},${c.bx},${c.by}`;
    if(!seen.has(k)){seen.add(k);result.push(circle(c));}
  }
  function walk(q,blocked=-1,depth=0){
    if(count++>50000||depth>80)return;
    q.forEach(add);
    for(let i=0;i<4;i++){
      if(i===blocked)continue;
      const child=reflect(q,i),c=child[i];
      if(visible(c,viewport,20/scale)&&scale/Math.abs(Number(c.b))>0.5)walk(child,i,depth+1);
    }
  }
  walk(config);return result;
}
