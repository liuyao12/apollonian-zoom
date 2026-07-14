function norm(x){return typeof x==='object'?x:{n:x,d:1n};}
function gcd(a,b){a=a<0n?-a:a;b=b<0n?-b:b;while(b){const r=a%b;a=b;b=r;}return a;}
function fraction(n,d){
 if(d<0n){n=-n;d=-d;}
 if(n===0n)return {n:0n,d:1n};
 const g=gcd(n,d);return {n:n/g,d:d/g};
}
function add(a,b){a=norm(a);b=norm(b);return fraction(a.n*b.d+b.n*a.d,a.d*b.d);}
function sub(a,b){a=norm(a);b=norm(b);return fraction(a.n*b.d-b.n*a.d,a.d*b.d);}
function mulInt(a,k){a=norm(a);return fraction(a.n*k,a.d);}
function num(a){a=norm(a);return Number(a.n)/Number(a.d);}
function key(c){return c.b.toString()+','+JSON.stringify(c.bx,(k,v)=>typeof v==='bigint'?v.toString():v)+','+JSON.stringify(c.by,(k,v)=>typeof v==='bigint'?v.toString():v);}

export function reflect(config,i){
 const out=config.map(c=>({...c}));
 let b=0n,bx={n:0n,d:1n},by={n:0n,d:1n};
 for(let j=0;j<4;j++)if(j!==i){b+=config[j].b;bx=add(bx,config[j].bx);by=add(by,config[j].by);}
 out[i]={b:2n*b-config[i].b,bx:sub(mulInt(bx,2n),config[i].bx),by:sub(mulInt(by,2n),config[i].by)};
 return out;
}
export function circle(c){return {b:c.b,bx:c.bx,by:c.by};}
export function toFloat(c){return {x:num(c.bx)/Number(c.b),y:num(c.by)/Number(c.b),r:1/Math.abs(Number(c.b)),b:c.b};}

export function generate(config,depth){
 const result=[],seen=new Set();
 function add(c){const k=key(c);if(!seen.has(k)){seen.add(k);result.push(circle(c));}}
 function walk(q,replaced,n){
  add(q[replaced]);
  if(n<=1)return;
  for(let i=0;i<4;i++)if(i!==replaced)walk(reflect(q,i),i,n-1);
 }
 config.forEach(add);
 if(depth>0)for(let i=0;i<4;i++)walk(reflect(config,i),i,depth);
 return result;
}

export function createTree(config){return {config,branches:null};}

function createValley(config,replaced){return {config:reflect(config,replaced),replaced,children:null};}
function expandRoot(root){if(root.branches===null)root.branches=[0,1,2,3].map(i=>createValley(root.config,i));}
function expandValley(node){
 if(node.children===null){
  node.children=[];
  for(let i=0;i<4;i++)if(i!==node.replaced)node.children.push(createValley(node.config,i));
 }
}

function intersectsCircle(c,v,margin=0){
 const x=toFloat(c);
 return Number.isFinite(x.x)&&Number.isFinite(x.y)&&Number.isFinite(x.r)&&
  !(x.x+x.r<v.left-margin||x.x-x.r>v.right+margin||x.y+x.r<v.bottom-margin||x.y-x.r>v.top+margin);
}

function tangencyPoint(a,b){
 const ca=toFloat(a),cb=toFloat(b);
 const ra=1/Number(a.b),rb=1/Number(b.b),d=ra+rb;
 return {x:(rb*ca.x+ra*cb.x)/d,y:(rb*ca.y+ra*cb.y)/d};
}

// The curved triangular valley lies inside the triangle formed by its three
// pairwise tangency points. Its descendants stay inside those same bounds, so
// an off-screen valley can be discarded without hiding another branch.
function intersectsValley(node,v,margin=0){
 const boundary=node.config.filter((_,i)=>i!==node.replaced);
 const points=[
  tangencyPoint(boundary[0],boundary[1]),
  tangencyPoint(boundary[0],boundary[2]),
  tangencyPoint(boundary[1],boundary[2])
 ];
 if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return true;
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 const left=Math.min(...xs),right=Math.max(...xs),bottom=Math.min(...ys),top=Math.max(...ys);
 return !(right<v.left-margin||left>v.right+margin||top<v.bottom-margin||bottom>v.top+margin);
}

export function visibleTree(root,viewport,scale,minRadiusPx=2){
 const result=[],seen=new Set();
 const worldMargin=minRadiusPx/scale;
 function add(c){
  if(scale/Math.abs(Number(c.b))<minRadiusPx||!intersectsCircle(c,viewport,worldMargin))return;
  const k=key(c);if(!seen.has(k)){seen.add(k);result.push(circle(c));}
 }
 function shouldVisit(node){
  const candidate=node.config[node.replaced];
  // Every child circle in this valley is no larger than its parent candidate.
  // This screen-space test is therefore the natural end of this branch.
  return scale/Math.abs(Number(candidate.b))>=minRadiusPx&&intersectsValley(node,viewport,worldMargin);
 }
 root.config.forEach(add);
 expandRoot(root);
 const stack=[...root.branches];
 while(stack.length){
  const node=stack.pop();
  if(!shouldVisit(node))continue;
  add(node.config[node.replaced]);
  expandValley(node);
  stack.push(...node.children);
 }
 return result;
}
export function generateVisible(config,viewport,scale){return visibleTree(createTree(config),viewport,scale);}
