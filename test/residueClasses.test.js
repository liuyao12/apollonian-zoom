import test from 'node:test';
import assert from 'node:assert/strict';
import {presets} from '../src/presets.js';
import {admissibleResidues,residueFromMod3Mod8,residueMod} from '../src/residueClasses.js';

test('normalizes signed residues modulo 24',()=>{
 assert.equal(residueMod(-1n),23);
 assert.equal(residueMod(24n),0);
 assert.equal(residueMod(49n),1);
});

test('lays out all mod-24 residues by their mod-3 and mod-8 coordinates',()=>{
 const grid=[];
 for(let mod3=0;mod3<3;mod3++)for(let mod8=0;mod8<8;mod8++)grid.push(residueFromMod3Mod8(mod3,mod8));
 assert.equal(new Set(grid).size,24);
 grid.forEach((residue,index)=>{
  assert.equal(residue%3,Math.floor(index/8));
  assert.equal(residue%8,index%8);
 });
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
