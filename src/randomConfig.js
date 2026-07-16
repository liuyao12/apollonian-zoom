function gcd(a,b){a=Math.abs(a);while(b){const r=a%b;a=b;b=r;}return a;}
function gcdAll(values){return values.reduce(gcd);}
function key(bends){return bends.join(',');}

let rootPool=null;

// Every primitive integral packing has a unique root quadruple. Enumerating
// small root quadruples therefore samples genuinely different packings, rather
// than moving to another Descartes configuration in the same packing.
export function primitiveRootCurvatures(){
 if(rootPool)return rootPool;
 const roots=[];
 for(let n=1;n<=60;n++){
  const a=-n;
  for(let b=n+1;b<=4*n+10;b++)for(let c=b;c<=12*n+30;c++){
   const q=a*b+a*c+b*c;
   if(q<0)continue;
   const r=Math.floor(Math.sqrt(q));
   if(r*r!==q)continue;
   const d=a+b+c-2*r;
   if(d<c||d<=0||gcdAll([n,b,c,d])!==1)continue;
   const bends=[a,b,c,d];
   const sum=bends.reduce((total,bend)=>total+bend,0);
   const squares=bends.reduce((total,bend)=>total+bend*bend,0);
   if(sum*sum===2*squares)roots.push(bends.map(BigInt));
  }
 }
 rootPool=roots;
 return rootPool;
}

export function randomRootCurvatures(excluded=[],rng=Math.random){
 const excludedKeys=new Set(excluded.map(key));
 const choices=primitiveRootCurvatures().filter(bends=>!excludedKeys.has(key(bends)));
 if(choices.length===0)throw new Error('No unused root configurations are available.');
 const index=Math.min(choices.length-1,Math.floor(rng()*choices.length));
 return [...choices[index]];
}
