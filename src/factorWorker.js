import {formatFactorLines} from './factorization.js';

self.onmessage=e=>{
 const {value}=e.data;
 let lines;
 try{lines=formatFactorLines(BigInt(value));}
 catch{lines=[value];}
 self.postMessage({value,lines});
};
