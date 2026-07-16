import test from 'node:test';
import assert from 'node:assert/strict';
import {configurationFromCurvatures,parseCurvatures} from '../src/customConfig.js';
import {primitiveRootCurvatures,randomRootCurvatures} from '../src/randomConfig.js';
import {presets} from '../src/presets.js';

function gcd(a,b){a=a<0n?-a:a;while(b){const r=a%b;a=b;b=r;}return a;}

function satisfiesDescartes(bends){
 const sum=bends.reduce((total,bend)=>total+bend,0n);
 const squares=bends.reduce((total,bend)=>total+bend*bend,0n);
 return sum*sum===2n*squares;
}

test('enumerates many primitive integral root quadruples',()=>{
 const roots=primitiveRootCurvatures();
 assert.ok(roots.length>400);
 for(const bends of roots){
  const [a,b,c,d]=bends;
  assert.ok(a<0n&&b<=c&&c<=d&&a+b+c>=d);
  assert.equal(bends.reduce(gcd),1n);
  assert.equal(satisfiesDescartes(bends),true);
  assert.doesNotThrow(()=>configurationFromCurvatures(bends));
 }
});

test('random selection excludes existing packing roots',()=>{
 const existing=Object.keys(presets).map(parseCurvatures);
 const bends=randomRootCurvatures(existing,()=>0);
 assert.equal(existing.some(candidate=>candidate.join(',')===bends.join(',')),false);
 assert.equal(satisfiesDescartes(bends),true);
});
