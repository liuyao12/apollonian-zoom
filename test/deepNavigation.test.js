import test from 'node:test';
import assert from 'node:assert/strict';
import {presets} from '../src/presets.js';
import {descendConfiguration,exactCircleValues} from '../src/deepNavigation.js';
import {cameraForCircle,projectCircle,scaleFromBigInt,traversalStage,visibleTreeProjected,zoomPathToCircle} from '../src/exactViewport.js';

test('a deep zoom path moves and magnifies continuously beyond Number range',()=>{
 const {target}=descendConfiguration(presets['(-1,2,2,3)'],800);
 const start=cameraForCircle(target,300,200,scaleFromBigInt(target.b,1));
 const path=zoomPathToCircle(start,target,1000,700,scaleFromBigInt(target.b,144));
 for(const t of [0,.25,.5,.75,1]){
  const p=projectCircle(target,path(t));
  assert.equal(p.x,300+200*t);assert.equal(p.y,200+150*t);
  assert.ok(Math.abs(p.r-144**t)<1e-8);
 }
});

test('a dive from inside a giant ancestor can ease out to its target',()=>{
 const config=presets['(-1,2,2,3)'],ancestor=config[1],{target}=descendConfiguration(config);
 const start=cameraForCircle(ancestor,500,350,scaleFromBigInt(1n<<2000n));
 assert.equal(Math.abs(projectCircle(target,start).x),Infinity);
 const path=zoomPathToCircle(start,target,1000,700,scaleFromBigInt(target.b,150));
 const midpoint=projectCircle(ancestor,path(.5)),end=projectCircle(target,path(1));
 assert.ok(Number.isFinite(midpoint.x)&&Number.isFinite(midpoint.y));
 assert.equal(end.x,500);assert.equal(end.y,350);assert.ok(Math.abs(end.r-150)<1e-8);
});

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
