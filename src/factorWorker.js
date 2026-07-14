import {formatFactorTerms} from './factorization.js';

self.onmessage=e=>{
 const {value}=e.data;
 let terms;
 try{terms=formatFactorTerms(BigInt(value));}
 catch{terms=[value];}
 self.postMessage({value,terms});
};
