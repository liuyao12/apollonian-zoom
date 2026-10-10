import test from 'node:test';
import assert from 'node:assert/strict';
import {presets} from '../src/presets.js';
import {descendConfiguration,exactCircleValues} from '../src/deepNavigation.js';
import {cameraForCircle,projectCircle,scaleFromBigInt,traversalStage,visibleTreeProjected} from '../src/exactViewport.js';

test('successive dives retain the exact target and viewport at over 500 digits',()=>{
 const root=presets['(-1,2,2,3)'];
 let config=root,stage=traversalStage(root),target,visible;
 for(let dive=0;dive<100;dive++){
  ({config,target}=descendConfiguration(config));
  const camera=cameraForCircle(target,500,350,scaleFromBigInt(target.b,150));
  visible=visibleTreeProjected(stage.config,camera,1000,700,2,stage.blockedIndex,stage.bridgeCircles);
  assert.ok(visible.some(c=>c.b===target.b),`target missing on dive ${dive}`);
  if(visible.nextStage)stage=traversalStage(visible.nextStage.config,visible.nextStage.blockedIndex,stage,visible.nextStage.bridgeCircles);
  const p=projectCircle(target,camera);
  assert.equal(p.x,500);assert.equal(p.y,350);assert.ok(Math.abs(p.r-150)<1e-8);
 }
 assert.ok(target.b.toString().length>500);
 assert.ok(visible.length<5000);
});

test('inspector preserves every digit and reduces exact center fractions',()=>{
 const {target}=descendConfiguration(presets['(-1,2,2,3)'],800);
 const values=exactCircleValues(target);
 assert.equal(values.curvature,target.b);
 assert.equal(values.x.n*target.bx.d*target.b,target.bx.n*values.x.d);
 assert.equal(values.y.n*target.by.d*target.b,target.by.n*values.y.d);
 assert.equal(values.radius.n,1n);assert.equal(values.radius.d,target.b);
});
