import {formatFactorTerms,isProbablePrime,primeFactorSteps} from './factorization.js?v=live-factors';

const jobs=new Map();
let queue=[],scheduled=false;

function run(){
 const deadline=performance.now()+12;
 while(queue.length&&performance.now()<deadline){
  const job=queue.shift(),sliceEnd=Math.min(deadline,performance.now()+3);
  let changed=false;
  while(job.remaining>1n&&performance.now()<sliceEnd){
   const step=job.steps.next();
   if(step.done)throw new Error('Incomplete factorization');
   if(step.value!==null){
    job.factors.push(step.value);job.remaining/=step.value;changed=true;
    break;
   }
  }
  const complete=job.remaining<=1n;
  if(changed||complete){
   const terms=formatFactorTerms(job.value,job.factors,job.remaining);
   self.postMessage({value:job.value,terms,complete,
    prime:complete?BigInt(job.value)>1n&&job.factors.length===1:undefined});
  }
  if(complete)jobs.set(job.value,null);else queue.push(job);
 }
 if(queue.length)setTimeout(run,0);else scheduled=false;
}

self.onmessage=e=>{
 const {value,mode,values}=e.data;
 if(mode==='prime'){
  self.postMessage({value,prime:isProbablePrime(BigInt(value))});return;
 }
 const wanted=new Set(values);
 queue=queue.filter(job=>wanted.has(job.value));
 for(const key of jobs.keys())if(!wanted.has(key))jobs.delete(key);
 for(const key of wanted)if(!jobs.has(key)){
  const n=BigInt(key);
  const job={value:key,steps:primeFactorSteps(n),remaining:n<0n?-n:n,factors:[]};
  jobs.set(key,job);queue.push(job);
 }
 if(!scheduled&&queue.length){scheduled=true;setTimeout(run,0);}
};
