import test from 'node:test';
import assert from 'node:assert/strict';
import {reflect} from '../src/apollonianBigInt.js';
import {presets} from '../src/presets.js';
import {cameraForCircle,giantCircleLine,projectedBoundary,projectCircle,reanchorCamera,scaleFromBigInt,stageNeedsParent,traversalStage,visibleTreeProjected,worldPointAt,zoomCameraAt} from '../src/exactViewport.js';

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

function circleKey(c){return `${c.b},${c.bx.n}/${c.bx.d},${c.by.n}/${c.by.d}`;}

test('stages an oriented valley without changing the visible circles',()=>{
 const root=presets['(-1,2,2,3)'],{target}=deepCircle(80);
 const camera=cameraForCircle(target,500,350,scaleFromBigInt(target.b,50));
 const global=visibleTreeProjected(root,camera,1000,700,2);
 assert.ok(global.nextStage);
 const local=visibleTreeProjected(global.nextStage.config,camera,1000,700,2,global.nextStage.blockedIndex,
  global.nextStage.bridgeCircles);
 assert.deepEqual(new Set(local.map(circleKey)),new Set(global.map(circleKey)));
 assert.ok(local.some(c=>c.b===target.b));
});

test('a staged valley requests its parent again at the home view',()=>{
 const root=presets['(-1,2,2,3)'],{target}=deepCircle(80);
 const deepCamera=cameraForCircle(target,500,350,scaleFromBigInt(target.b,50));
 const visible=visibleTreeProjected(root,deepCamera,1000,700,2);
 const stage=traversalStage(visible.nextStage.config,visible.nextStage.blockedIndex,traversalStage(root));
 const outer=root.find(c=>c.b<0n),homeCamera=cameraForCircle(outer,500,350,scaleFromBigInt(1n,280));
 assert.equal(stageNeedsParent(stage,homeCamera,1000,700),true);
});

test('panning across a valley boundary restores its parent even without a visible corner',()=>{
 const root=presets['(-1,2,2,3)'],{target}=deepCircle(80);
 const camera=cameraForCircle(target,500,350,scaleFromBigInt(target.b,50));
 const visible=visibleTreeProjected(root,camera,1000,700,2);
 const stage=traversalStage(visible.nextStage.config,visible.nextStage.blockedIndex,traversalStage(root));
 const boundary=stage.config.find((c,i)=>i!==stage.blockedIndex&&c.b>0n);
 const across=cameraForCircle(boundary,500,350,camera.scale);
 assert.equal(stageNeedsParent(stage,across,1000,700),true);
});

test('retains exact visible tangencies for arithmetic overlays',()=>{
 const config=presets['(-1,2,2,3)'];
 const outer=config.find(c=>c.b<0n),camera=cameraForCircle(outer,500,350,scaleFromBigInt(1n,280));
 const visible=visibleTreeProjected(config,camera,1000,700,20,null,[],true);
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

test('zooming a distant pivot preserves the exact target beyond Number range',()=>{
 const {target}=deepCircle(1000);
 const camera=cameraForCircle(target,500,350,scaleFromBigInt(target.b,50));
 const pivot=worldPointAt(camera,550,320);
 zoomCameraAt(camera,550,320,550,320,1.1);
 const denominator=camera.anchorX.d;
 for(let i=0;i<499;i++)zoomCameraAt(camera,550,320,550,320,1.1);
 const final=worldPointAt(camera,550,320);
 const delta=(a,b)=>({n:a.n*b.d-b.n*a.d,d:a.d*b.d});
 const dx=delta(final.x,pivot.x),dy=delta(final.y,pivot.y);
 // Compare rational world errors to a single pixel at the final scale.
 const unit=1n<<BigInt(camera.scale.exponent);
 assert.ok((dx.n<0n?-dx.n:dx.n)*unit*100000000n<dx.d);
 assert.ok((dy.n<0n?-dy.n:dy.n)*unit*100000000n<dy.d);
 assert.equal(camera.screenX,550);assert.equal(camera.screenY,320);
 assert.equal(camera.anchorX.d,denominator,'stationary pivots must not grow denominators');
});

test('a deep pinch moves its exact pivot to the new screen location',()=>{
 const {target}=deepCircle(800);
 const camera=cameraForCircle(target,500,350,scaleFromBigInt(target.b,50));
 zoomCameraAt(camera,500,350,610,290,2.5);
 const p=projectCircle(target,camera);
 assert.ok(Math.abs(p.x-610)<1e-8);assert.ok(Math.abs(p.y-290)<1e-8);
 assert.ok(Math.abs(p.r-125)<1e-8);
});

test('renders an exact tangent consistently after a far camera reanchor',()=>{
 const {target}=deepCircle(80),camera=cameraForCircle(target,500,350,scaleFromBigInt(target.b,50));
 const config=presets['(-1,2,2,3)'];
 // At the tangency of the two initial circles, their boundaries remain
 // visible even when their screen-space centers overflow.
 camera.anchorX={n:0n,d:1n};camera.anchorY={n:0n,d:1n};
 camera.scale=scaleFromBigInt(1n<<2000n,1);
 const before=projectedBoundary(config[1],camera,1000,700);
 assert.equal(before.type,'line');
 zoomCameraAt(camera,900,100,900,100,1);
 const after=projectedBoundary(config[1],camera,1000,700);
 assert.equal(after.type,'line');
 assert.ok(Math.abs(before.x1-after.x1)<1e-8);
 assert.ok(Math.abs(before.y1-after.y1)<1e-8);
});

test('uses a line only when curvature is below the pixel error bound',()=>{
 const circle=presets['(-1,2,2,3)'][1];
 const camera=cameraForCircle(circle,500,350,scaleFromBigInt(2n,100000));
 camera.screenX-=100000;
 assert.equal(projectedBoundary(circle,camera,1000,700).type,'arc');
 camera.scale=scaleFromBigInt(2n,4000000);camera.screenX=500-4000000;
 assert.equal(projectedBoundary(circle,camera,1000,700).type,'line');
});
