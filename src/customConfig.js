function abs(n){return n<0n?-n:n;}
function gcd(a,b){a=abs(a);b=abs(b);while(b){const r=a%b;a=b;b=r;}return a;}
function fraction(n,d=1n){
 if(d===0n)throw new Error('Division by zero');
 if(d<0n){n=-n;d=-d;}
 const g=gcd(n,d);
 return {n:n/g,d:d/g};
}
function add(a,b){return fraction(a.n*b.d+b.n*a.d,a.d*b.d);}
function sub(a,b){return fraction(a.n*b.d-b.n*a.d,a.d*b.d);}
function mul(a,b){return fraction(a.n*b.n,a.d*b.d);}
function div(a,b){return fraction(a.n*b.d,a.d*b.n);}
function square(a){return mul(a,a);}
function equal(a,b){return a.n===b.n&&a.d===b.d;}

function integerSqrt(n){
 if(n<0n)return null;
 if(n<2n)return n;
 let x=1n<<BigInt((n.toString(2).length+1)>>1);
 while(true){
  const next=(x+n/x)>>1n;
  if(next>=x)return x*x===n?x:null;
  x=next;
 }
}

function sqrtFraction(value){
 if(value.n<0n)return null;
 const n=integerSqrt(value.n),d=integerSqrt(value.d);
 return n===null||d===null?null:fraction(n,d);
}

function centerFromTwoDistances(baseDistance,originDistance,otherDistance){
 const twoBase={n:2n*baseDistance.n,d:baseDistance.d};
 const x=div(add(square(baseDistance),sub(square(originDistance),square(otherDistance))),twoBase);
 const y=sqrtFraction(sub(square(originDistance),square(x)));
 if(y===null)throw new Error('These curvatures do not produce exact rational centers.');
 return {x,y};
}

function representedCircle(b,x,y){return {b,bx:mul({n:b,d:1n},x),by:mul({n:b,d:1n},y)};}

export function parseCurvatures(text){
 const cleaned=text.trim().replace(/[()]/g,' ');
 const parts=cleaned.split(/[\s,]+/).filter(Boolean);
 if((parts.length!==3&&parts.length!==4)||parts.some(part=>!/^[-+]?\d+$/.test(part)))
  throw new Error('Enter three or four integers, such as (-1, 2, 2).');
 return parts.map(part=>BigInt(part));
}

function normalizedBends(bends){
 const negatives=bends.filter(b=>b<0n),positives=bends.filter(b=>b>0n).sort((a,b)=>a<b?-1:a>b?1:0);
 if(negatives.length!==1||positives.length!==3)
  throw new Error('Use one negative enclosing curvature and three positive curvatures.');
 return [negatives[0],...positives];
}

export function completeCurvatures(input){
 const bends=input.map(BigInt);
 if(bends.length===4)return normalizedBends(bends);
 if(bends.length!==3)throw new Error('Enter three or four integer curvatures.');
 const [a,b,c]=bends,q=a*b+a*c+b*c;
 const root=integerSqrt(q);
 if(root===null)throw new Error('These three integers do not have an integer Descartes completion.');
 const sum=a+b+c;
 const candidates=[sum-2n*root,sum+2n*root]
  .filter((value,index,all)=>value!==0n&&all.indexOf(value)===index)
  .map(value=>[...bends,value])
  .filter(values=>values.filter(value=>value<0n).length===1&&values.filter(value=>value>0n).length===3);
 if(candidates.length===0)throw new Error('These curvatures do not complete to a bounded packing.');
 // Three tangent circles can have two Soddy-circle completions. They generate
 // the same packing; the smaller bend is the reduced initial configuration.
 candidates.sort((left,right)=>{
  const leftAdded=abs(left[3]),rightAdded=abs(right[3]);
  return leftAdded<rightAdded?-1:leftAdded>rightAdded?1:0;
 });
 return normalizedBends(candidates[0]);
}

export function configurationFromCurvatures(input){
 const bends=completeCurvatures(input);
 if(bends.filter(b=>b<0n).length!==1||bends.filter(b=>b>0n).length!==3)
  throw new Error('Use one negative enclosing curvature and three positive curvatures.');
 const sum=bends.reduce((a,b)=>a+b,0n);
 const squareSum=bends.reduce((a,b)=>a+b*b,0n);
 if(sum*sum!==2n*squareSum)throw new Error('These integers do not satisfy Descartes’ circle equation.');

 const [outer,a,b,c]=bends;
 const R=fraction(1n,-outer),ra=fraction(1n,a),rb=fraction(1n,b),rc=fraction(1n,c);
 const dA=sub(R,ra),dB=sub(R,rb),dC=sub(R,rc);
 if(dA.n<=0n||dB.n<=0n||dC.n<=0n)throw new Error('The negative curvature must describe a circle enclosing the other three.');

 const zero=fraction(0n),aCenter={x:dA,y:zero};
 const bCenter=centerFromTwoDistances(dA,dB,add(ra,rb));
 const cUnsigned=centerFromTwoDistances(dA,dC,add(ra,rc));
 const target=square(add(rb,rc));
 const plusDistance=add(square(sub(bCenter.x,cUnsigned.x)),square(sub(bCenter.y,cUnsigned.y)));
 const minusY=fraction(-cUnsigned.y.n,cUnsigned.y.d);
 const minusDistance=add(square(sub(bCenter.x,cUnsigned.x)),square(sub(bCenter.y,minusY)));
 let cY;
 if(equal(plusDistance,target))cY=cUnsigned.y;
 else if(equal(minusDistance,target))cY=minusY;
 else throw new Error('The fourth circle is not tangent to the other three.');

 return [
  representedCircle(outer,zero,zero),
  representedCircle(a,aCenter.x,aCenter.y),
  representedCircle(b,bCenter.x,bCenter.y),
  representedCircle(c,cUnsigned.x,cY)
 ];
}
