import test from 'node:test';
import assert from 'node:assert/strict';
import {presets} from '../src/presets.js';
import {admissibleResidues,residueMod} from '../src/residueClasses.js';

test('normalizes signed residues modulo 24',()=>{
 assert.equal(residueMod(-1n),23);
 assert.equal(residueMod(24n),0);
 assert.equal(residueMod(49n),1);
});

const expected={
 '(-1,2,2,3)':[2,3,6,11,14,15,18,23],
 '(-2,3,6,7)':[3,6,7,10,15,18,19,22],
 '(-3,5,8,8)':[0,5,8,12,20,21],
 '(-6,11,14,15)':[2,3,6,11,14,15,18,23],
 '(-13,23,30,38)':[2,3,6,11,14,15,18,23],
 '(-76,77,5852,5853)':[0,5,8,12,20,21]
};

for(const [name,residues] of Object.entries(expected)){
 test(`finds the admissible mod-24 classes for ${name}`,()=>{
  assert.deepEqual(admissibleResidues(presets[name]),residues);
 });
}
