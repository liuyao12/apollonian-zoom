import test from 'node:test';
import assert from 'node:assert/strict';
import {reflect} from '../src/apollonianBigInt.js';
import {presets} from '../src/presets.js';
import {cameraForCircle,giantCircleLine,projectCircle,reanchorCamera,scaleFromBigInt,visibleTreeProjected} from '../src/exactViewport.js';

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

test('retains exact visible tangencies for arithmetic overlays',()=>{
 const config=presets['(-1,2,2,3)'];
 const outer=config.find(c=>c.b<0n),camera=cameraForCircle(outer,500,350,scaleFromBigInt(1n,280));
 const visible=visibleTreeProjected(config,camera,1000,700,20);
 const bend3=visible.find(c=>c.b===3n),bend2=visible.find(c=>c.b===2n);
 assert.ok(bend3?.neighborBends.includes(2n));
 assert.ok(bend2?.neighborBends.includes(3n));
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

test('reanchoring a deep view preserves its screen transform',()=>{
 const {config,target}=deepCircle(100);
 const camera=cameraForCircle(target,2500,-1500,scaleFromBigInt(target.b,50));
 const candidate=config.find(circle=>circle!==target&&circle.b>0n);
 const before=config.map(circle=>projectCircle(circle,camera));
 const candidateScreen=projectCircle(candidate,camera);
 reanchorCamera(camera,candidate,candidateScreen);
 const after=config.map(circle=>projectCircle(circle,camera));
 for(let i=0;i<before.length;i++){
  assert.ok(Math.abs(before[i].x-after[i].x)<1e-8);
  assert.ok(Math.abs(before[i].y-after[i].y)<1e-8);
  assert.ok(Math.abs(before[i].r-after[i].r)<1e-8);
 }
});
