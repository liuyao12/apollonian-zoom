import test from 'node:test';
import assert from 'node:assert/strict';
import {isProbablePrime} from '../src/factorization.js';

test('recognizes prime bends used by the glow overlay',()=>{
 for(const prime of [2n,3n,5n,23n,1000000007n])assert.equal(isProbablePrime(prime),true);
 for(const composite of [-3n,0n,1n,4n,21n,1000000009n*1000000007n])assert.equal(isProbablePrime(composite),false);
});
