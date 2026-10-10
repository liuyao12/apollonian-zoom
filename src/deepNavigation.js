import {reflect} from './apollonianBigInt.js';

// Move into successively smaller gaps using exact Descartes reflections.
// This is useful once a circle's full curvature no longer fits its label.
export function descendConfiguration(configuration,steps=12){
 let config=configuration,blocked=-1,target=null;
 for(let step=0;step<steps;step++){
  let best=null,index=-1;
  for(let i=0;i<4;i++)if(i!==blocked){
   const candidate=reflect(config,i);
   if(!best||candidate[i].b>best[index].b){best=candidate;index=i;}
  }
  config=best;blocked=index;target=config[index];
 }
 return {config,target};
}

export function exactCircleValues(c){
 function reduced(n,d){
  if(d<0n){n=-n;d=-d;}
  let a=n<0n?-n:n,b=d;
  while(b){const r=a%b;a=b;b=r;}
  return {n:n/a,d:d/a};
 }
 return {curvature:c.b,x:reduced(c.bx.n,c.bx.d*c.b),y:reduced(c.by.n,c.by.d*c.b),
  radius:reduced(1n,c.b<0n?-c.b:c.b)};
}
