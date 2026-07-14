function abs(n){return n<0n?-n:n;}
function gcd(a,b){a=abs(a);b=abs(b);while(b){const r=a%b;a=b;b=r;}return a;}

function modPow(base,exponent,modulus){
 let result=1n;base%=modulus;
 while(exponent>0n){
  if(exponent&1n)result=result*base%modulus;
  base=base*base%modulus;exponent>>=1n;
 }
 return result;
}

function isProbablePrime(n){
 if(n<2n)return false;
 const small=[2n,3n,5n,7n,11n,13n,17n,19n,23n,29n,31n,37n];
 for(const p of small){if(n===p)return true;if(n%p===0n)return false;}
 let d=n-1n,s=0;
 while((d&1n)===0n){d>>=1n;s++;}
 for(const base of small){
  if(base>=n-1n)continue;
  let x=modPow(base,d,n);
  if(x===1n||x===n-1n)continue;
  let passed=false;
  for(let r=1;r<s;r++){x=x*x%n;if(x===n-1n){passed=true;break;}}
  if(!passed)return false;
 }
 return true;
}

function pollardRho(n,budget){
 if(n%2n===0n)return 2n;
 if(n%3n===0n)return 3n;
 for(let attempt=1n;attempt<=24n;attempt++){
  const c=attempt,x0=2n+attempt;
  let x=x0%n,y=x,d=1n;
  while(d===1n&&budget.remaining-- > 0){
   x=(x*x+c)%n;
   y=(y*y+c)%n;y=(y*y+c)%n;
   d=gcd(x-y,n);
  }
  if(d>1n&&d<n)return d;
  if(budget.remaining<=0)break;
 }
 throw new Error('factorization budget exceeded');
}

export function factorize(value,maxIterations=500000){
 let n=abs(BigInt(value));
 if(n<2n)return [n];
 const factors=[],budget={remaining:maxIterations};
 function split(part){
  if(part===1n)return;
  if(isProbablePrime(part)){factors.push(part);return;}
  const divisor=pollardRho(part,budget);
  split(divisor);split(part/divisor);
 }
 split(n);factors.sort((a,b)=>a<b?-1:a>b?1:0);
 return factors;
}

const superscripts={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
function superscript(n){return String(n).split('').map(d=>superscripts[d]).join('');}

export function formatFactorLines(value){
 const n=BigInt(value),factors=factorize(n);
 if(n>=-1n&&n<=1n)return [n.toString()];
 const powers=[];
 for(const factor of factors){
  const last=powers[powers.length-1];
  if(last&&last.factor===factor)last.exponent++;
  else powers.push({factor,exponent:1});
 }
 const lines=powers.map(({factor,exponent},i)=>(i||n<0n?'· ':'')+factor+(exponent>1?superscript(exponent):''));
 if(n<0n)lines.unshift('-1');
 return lines;
}
