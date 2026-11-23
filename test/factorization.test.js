import test from 'node:test';
import assert from 'node:assert/strict';
import {factorize,formatFactorTerms,isProbablePrime,primeFactorSteps} from '../src/factorization.js';

test('recognizes prime bends used by the glow overlay',()=>{
 for(const prime of [2n,3n,5n,23n,1000000007n])assert.equal(isProbablePrime(prime),true);
 for(const composite of [-3n,0n,1n,4n,21n,1000000009n*1000000007n])assert.equal(isProbablePrime(composite),false);
});

test('a signed composite exposes known powers before the remaining search finishes',()=>{
 const cofactor=1009n*1013n,value=-4n*cofactor,steps=primeFactorSteps(value);
 const factors=[steps.next().value,steps.next().value];
 assert.deepEqual(factors,[2n,2n]);
 assert.deepEqual(formatFactorTerms(value,factors,cofactor),['-1','2²',String(cofactor)]);
 assert.equal(steps.next().value,null);
 for(const step of steps)if(step!==null)factors.push(step);
 assert.deepEqual(formatFactorTerms(value,factors),['-1','2²','1009','1013']);
 assert.equal(factors.reduce((n,p)=>n*p,-1n),value);
});

test('factor labels handle primes, units and repeated factors',()=>{
 for(const n of [-1n,0n,1n,97n])assert.deepEqual(formatFactorTerms(n),[String(n)]);
 assert.deepEqual(formatFactorTerms(-72n),['-1','2³','3²']);
 assert.throws(()=>factorize(1009n*1013n,0),/budget/);
});
