function isFrac(x){return typeof x==='object';}
function addFrac(a,b){return {n:a.n*b.d+b.n*a.d,d:a.d*b.d};}
function subFrac(a,b){return {n:a.n*b.d-b.n*a.d,d:a.d*b.d};}
function mulFrac(a,b){return {n:a.n*b.n,d:a.d*b.d};}
function negFrac(a){return {n:-a.n,d:a.d};}
function fracToNumber(a){return Number(a.n)/Number(a.d);}
function norm(x){return isFrac(x)?x:{n:x,d:1n};}

export function reflect(config,i){
 const out=config.map(c=>({...c}));
 let b=0n,bx={n:0n,d:1n},by={n:0n,d:1n};
 for(let j=0;j<4;j++) if(j!==i){
  b+=config[j].b;
  bx=addFrac(bx,norm(config[j].bx));
  by=addFrac(by,norm(config[j].by));
 }
 const old=config[i];
 out[i]={b:2n*b-old.b,bx:subFrac({n:2n,d:1n}, {n:0n,d:1n}),by:old.by};
 out[i].bx={n:2n*bx.n*old.bx.d-old.b*norm(old.bx).n,d:bx.d*norm(old.bx).d};
 out[i].by={n:2n*by.n*norm(old.by).d-old.b*norm(old.by).n,d:by.d*norm(old.by).d};
 return out;
}

export function circle(c){return {b:c.b,bx:c.bx,by:c.by};}
export function toFloat(c){return {x:fracToNumber(norm(c.bx))/Number(c.b),y:fracToNumber(norm(c.by))/Number(c.b),r:1/Math.abs(Number(c.b)),b:c.b};}

export function generate(config,depth){
 const result=[],seen=new Set();
 function add(c){const k=JSON.stringify(c);if(!seen.has(k)){seen.add(k);result.push(circle(c));}}
 function walk(q,n){q.forEach(add);if(n>0)for(let i=0;i<4;i++)walk(reflect(q,i),n-1);}
 walk(config,depth);return result;
}

function visible(c,v,margin){const x=toFloat(c);return !(x.x+x.r<v.left-margin||x.x-x.r>v.right+margin||x.y+x.r<v.bottom-margin||x.y-x.r>v.top+margin);}
export function generateVisible(config,viewport,scale){
 const result=[],seen=new Set();let count=0;
 function add(c){if(!visible(c,viewport,20/scale))return;const k=JSON.stringify(c);if(!seen.has(k)){seen.add(k);result.push(circle(c));}}
 function walk(q,blocked=-1,depth=0){if(count++>50000||depth>80)return;q.forEach(add);for(let i=0;i<4;i++){if(i===blocked)continue;const child=reflect(q,i),c=child[i];if(visible(c,viewport,20/scale)&&scale/Math.abs(Number(c.b))>.5)walk(child,i,depth+1);}}
 walk(config);return result;
}
