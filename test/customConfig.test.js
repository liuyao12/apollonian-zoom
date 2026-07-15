import test from 'node:test';
import assert from 'node:assert/strict';
import {completeCurvatures,configurationFromCurvatures,parseCurvatures} from '../src/customConfig.js';
import {presets} from '../src/presets.js';

function squaredDistance(a,b){
 const ax=Number(a.bx.n)/Number(a.bx.d)/Number(a.b);
 const ay=Number(a.by.n)/Number(a.by.d)/Number(a.b);
 const bx=Number(b.bx.n)/Number(b.bx.d)/Number(b.b);
 const by=Number(b.by.n)/Number(b.by.d)/Number(b.b);
 return (ax-bx)**2+(ay-by)**2;
}

test('parses common custom curvature formats',()=>{
 assert.deepEqual(parseCurvatures('(-1, 2, 2, 3)'),[-1n,2n,2n,3n]);
 assert.deepEqual(parseCurvatures('-2 3 6'),[-2n,3n,6n]);
});

test('deduces a missing outer or inner curvature',()=>{
 assert.deepEqual(completeCurvatures([2n,2n,3n]),[-1n,2n,2n,3n]);
 assert.deepEqual(completeCurvatures([-1n,2n,2n]),[-1n,2n,2n,3n]);
 assert.deepEqual(completeCurvatures([-1n,2n,6n]),[-1n,2n,3n,6n]);
});

for(const name of Object.keys(presets))test(`reconstructs tangent centers for ${name}`,()=>{
 const bends=parseCurvatures(name),config=configurationFromCurvatures(bends);
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
  const ri=1/Math.abs(Number(config[i].b)),rj=1/Math.abs(Number(config[j].b));
  const expected=config[i].b<0n||config[j].b<0n?Math.abs(ri-rj):ri+rj;
  assert.ok(Math.abs(squaredDistance(config[i],config[j])-expected**2)<1e-12);
 }
});

test('rejects a quadruple that fails Descartes equation',()=>{
 assert.throws(()=>configurationFromCurvatures([-1n,2n,3n,4n]),/Descartes/);
});

test('constructs a valid non-preset configuration',()=>{
 assert.doesNotThrow(()=>configurationFromCurvatures([-1n,2n,6n]));
});
