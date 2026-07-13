function norm(x){return typeof x==='object'?x:{n:x,d:1n};}
function add(a,b){a=norm(a);b=norm(b);return {n:a.n*b.d+b.n*a.d,d:a.d*b.d};}
function sub(a,b){a=norm(a);b=norm(b);return {n:a.n*b.d-b.n*a.d,d:a.d*b.d};}
function mulInt(a,k){a=norm(a);return {n:a.n*k,d:a.d};}
function num(a){a=norm(a);return Number(a.n)/Number(a.d);}
function key(c){return c.b.toString()+','+JSON.stringify(c.bx,(k,v)=>typeof v==='bigint'?v.toString():v)+','+JSON.stringify(c.by,(k,v)=>typeof v==='bigint'?v.toString():v);}
export function reflect(config,i){const out=config.map(c=>({...c}));let b=0n,bx={n:0n,d:1n},by={n:0n,d:1n};for(let j=0;j<4;j++)if(j!==i){b+=config[j].b;bx=add(bx,config[j].bx);by=add(by,config[j].by);}out[i]={b:2n*b-config[i].b,bx:sub(mulInt(bx,2n),config[i].bx),by:sub(mulInt(by,2n),config[i].by)};return out;}
export function circle(c){return {b:c.b,bx:c.bx,by:c.by};}
export function toFloat(c){return {x:num(c.bx)/Number(c.b),y:num(c.by)/Number(c.b),r:1/Math.abs(Number(c.b)),b:c.b};}
export function createTree(config){return {config,children:null};}
function expand(node){if(!node.children){node.children=[];for(let i=0;i<4;i++)node.children.push(createTree(reflect(node.config,i)));}}
function visible(c,v,m){const x=toFloat(c);return Number.isFinite(x.x)&&Number.isFinite(x.y)&&Number.isFinite(x.r)&&!(x.x+x.r<v.left-m||x.x-x.r>v.right+m||x.y+x.r<v.bottom-m||x.y-x.r>v.top+m);}
export function visibleTree(root,viewport,scale){const result=[],seen=new Set();function add(c){const k=key(c);if(visible(c,viewport,20/scale)&&!seen.has(k)){seen.add(k);result.push(circle(c));}}function walk(node,depth=0){node.config.forEach(add);if(depth>100)return;expand(node);for(const child of node.children){if(child.config.some(c=>visible(c,viewport,20/scale))||depth<4)walk(child,depth+1);}}walk(root);return result;}
export function generateVisible(config,viewport,scale){return visibleTree(createTree(config),viewport,scale);}
