function abs(n){return n<0n?-n:n;}
function gcd(a,b){a=abs(a);b=abs(b);while(b){const r=a%b;a=b;b=r;}return a;}
const smallPrimes=[2n,3n,5n,7n,11n,13n,17n,19n,23n,29n,31n,37n];

function modPow(base,exponent,modulus){
 let result=1n;base%=modulus;
 while(exponent>0n){
  if(exponent&1n)result=result*base%modulus;
  base=base*base%modulus;exponent>>=1n;
 }
 return result;
}

export function isProbablePrime(n){
 n=BigInt(n);
 if(n<2n)return false;
 for(const p of smallPrimes){if(n===p)return true;if(n%p===0n)return false;}
 let d=n-1n,s=0;
 while((d&1n)===0n){d>>=1n;s++;}
 for(const base of smallPrimes){
  if(base>=n-1n)continue;
  let x=modPow(base,d,n);
  if(x===1n||x===n-1n)continue;
  let passed=false;
  for(let r=1;r<s;r++){x=x*x%n;if(x===n-1n){passed=true;break;}}
  if(!passed)return false;
 }
 return true;
}

function* pollardRho(n){
 for(let attempt=1n;;attempt++){
  const c=attempt,x0=2n+attempt;
  let x=x0%n,y=x,d=1n;
  while(d===1n){
   x=(x*x+c)%n;
   y=(y*y+c)%n;y=(y*y+c)%n;
   d=gcd(x-y,n);
   yield null;
  }
  if(d>1n&&d<n)return d;
 }
}

// A prime is ready to display. A null step lets the worker pause the rho
// search here and resume with the same iterates after serving another label.
export function* primeFactorSteps(value){
 let n=abs(BigInt(value));
 if(n<2n)return;
 for(const prime of smallPrimes){
  while(n%prime===0n){n/=prime;yield prime;}
 }
 const parts=[n];
 while(parts.length){
  const part=parts.pop();
  if(part===1n)continue;
  if(isProbablePrime(part)){yield part;continue;}
  const divisor=yield* pollardRho(part),other=part/divisor;
  if(divisor<other)parts.push(other,divisor);else parts.push(divisor,other);
 }
}

export function factorize(value,maxIterations=500000){
 const n=abs(BigInt(value)),factors=[];
 if(n<2n)return [n];
 for(const step of primeFactorSteps(n)){
  if(step!==null)factors.push(step);
  else if(--maxIterations<0)throw new Error('factorization budget exceeded');
 }
 return factors.sort((a,b)=>a<b?-1:a>b?1:0);
}

const superscripts={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
function superscript(n){return String(n).split('').map(d=>superscripts[d]).join('');}

export function formatFactorTerms(value,factors=factorize(value),remaining=1n){
 const n=BigInt(value);
 if(n>=-1n&&n<=1n)return [n.toString()];
 const powers=[];
 for(const factor of [...factors].sort((a,b)=>a<b?-1:a>b?1:0)){
  const last=powers[powers.length-1];
  if(last&&last.factor===factor)last.exponent++;
  else powers.push({factor,exponent:1});
 }
 const terms=powers.map(({factor,exponent})=>factor+(exponent>1?superscript(exponent):''));
 if(n<0n)terms.unshift('-1');
 if(remaining>1n)terms.push(remaining.toString());
 return terms;
}
