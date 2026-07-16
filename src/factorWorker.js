import {formatFactorTerms,isProbablePrime} from './factorization.js';

self.onmessage=e=>{
 const {value,mode='factor'}=e.data;
 if(mode==='prime'){
  self.postMessage({value,prime:isProbablePrime(BigInt(value))});return;
 }
 let terms;
 try{terms=formatFactorTerms(BigInt(value));}
 catch{terms=[value];}
 self.postMessage({value,terms,prime:isProbablePrime(BigInt(value))});
};
