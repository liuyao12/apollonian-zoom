import test from 'node:test';
import assert from 'node:assert/strict';
import {reflect} from '../src/apollonianBigInt.js';
import {presets} from '../src/presets.js';
import {cameraForCircle,giantCircleLine,projectCircle,scaleFromBigInt,visibleTreeProjected} from '../src/exactViewport.js';

function deepCircle(depth){
 let config=presets['(-1,2,2,3)'],target;
 for(let step=1;step<=depth;step++){
  const replaced=(step-1)%4;config=reflect(config,replaced);target=config[replaced];
 }
 return {config,target};
}

test('keeps a 700-level circle centered beyond Number range',()=>{
 const {target}=deepCircle(700),camera=cameraForCircle(target,500,350,scaleFromBigInt(target.b,50));
 const projected=projectCircle(target,camera);
 assert.ok(target.b.toString().length>308);
 assert.equal(projected.x,500);assert.equal(projected.y,350);
 assert.ok(Math.abs(projected.r-50)<1e-10);
});

test('finds deep visible circles without a floating-point world viewport',()=>{
 const {target}=deepCircle(45),camera=cameraForCircle(target,500,350,scaleFromBigInt(target.b,50));
 const visible=visibleTreeProjected(presets['(-1,2,2,3)'],camera,1000,700,2);
 assert.ok(visible.some(c=>c.b===target.b));
 assert.ok(visible.length<5000,`unexpectedly visited ${visible.length} visible circles`);
});

test('draws an overflowing ancestor circle as its local tangent line',()=>{
 let config=presets['(-1,2,2,3)'],target;
 for(let step=1;step<=4000;step++){
  const replaced=step%2?1:2;config=reflect(config,replaced);target=config[replaced];
 }
 const outer=config.find(c=>c.b<0n),camera=cameraForCircle(target,500,350,scaleFromBigInt(target.b,50));
 assert.ok(projectCircle(outer,camera).r>1e9);
 assert.equal(giantCircleLine(outer,camera,1000,700).type,'line');
});
