import test from 'node:test';
import assert from 'node:assert/strict';
import {placeVisibleLabel} from '../src/labelPlacement.js';
import {cameraForCircle,projectedLabelPlacement,scaleFromBigInt,visibleTreeProjected} from '../src/exactViewport.js';
import {presets} from '../src/presets.js';

const viewport=(width,height)=>[{left:0,right:width,top:0,bottom:height}];
const rects=viewport(400,400);
test('an off-screen center gets a label entirely in the visible disk',()=>{
 const shape={type:'disk',x:-50,y:200,r:100};
 const label=placeVisibleLabel(shape,rects);
 assert.ok(label);
 assert.ok(label.x-label.r>=8-1e-8);
 assert.ok(label.y-label.r>=8-1e-8);
 assert.ok(Math.hypot(label.x-shape.x,label.y-shape.y)+label.r<=shape.r+1e-8);
});

test('a fully visible circle keeps its center',()=>{
 const label=placeVisibleLabel({type:'disk',x:200,y:180,r:80},rects);
 assert.equal(label.x,200);assert.equal(label.y,180);
 assert.ok(Math.abs(label.r-80)<1e-6);
});

test('a fully visible enclosing circle keeps its label outside the packing',()=>{
 const config=presets['(-1,2,2,3)'];
 const camera=cameraForCircle(config[0],200,200,{mantissa:150,exponent:0});
 const label=projectedLabelPlacement(config[0],camera,400,400,rects);
 assert.ok(label);
 assert.ok(Math.hypot(label.x-200,label.y-200)-label.r>=150-1e-8);
});

test('a clipped semicircle uses its area centroid rather than its largest inscribed disk',()=>{
 const label=placeVisibleLabel({type:'disk',x:0,y:200,r:100},rects);
 assert.ok(Math.abs(label.x-400/(3*Math.PI))<1e-5);
 assert.ok(Math.abs(label.y-200)<1e-5);
});

test('a clipped quarter circle uses its area centroid',()=>{
 const label=placeVisibleLabel({type:'disk',x:0,y:0,r:100},rects);
 assert.ok(Math.abs(label.x-400/(3*Math.PI))<1e-5);
 assert.ok(Math.abs(label.y-400/(3*Math.PI))<1e-5);
});

test('a diagonal line labels the centroid of its visible triangle',()=>{
 const label=placeVisibleLabel({type:'halfPlane',nx:-Math.SQRT1_2,ny:-Math.SQRT1_2,offset:400*Math.SQRT1_2},rects);
 assert.ok(Math.abs(label.x-400/3)<1e-5);
 assert.ok(Math.abs(label.y-400/3)<1e-5);
});

test('overflowing tangent circles label their respective visible sides',()=>{
 const config=presets['(-1,2,2,3)'];
 const camera=cameraForCircle(config[0],500,350,scaleFromBigInt(1n<<2000n));
 const free=viewport(1000,700);
 const left=projectedLabelPlacement(config[1],camera,1000,700,free);
 const right=projectedLabelPlacement(config[2],camera,1000,700,free);
 assert.ok(left&&right);
 assert.equal(left.x,250);assert.equal(left.y,350);
 assert.equal(right.x,750);assert.equal(right.y,350);
 assert.ok(left.x+left.r<=500+1e-8);
 assert.ok(right.x-right.r>=500-1e-8);
});

test('a viewport entirely inside a circle retains its exact number',()=>{
 const config=presets['(-1,2,2,3)'],target=config[1];
 const camera=cameraForCircle(target,500,350,scaleFromBigInt(1n<<2000n));
 const visible=visibleTreeProjected(config,camera,1000,700,2);
 assert.ok(visible.some(c=>c.b===target.b&&c.bx.n===target.bx.n));
 const label=projectedLabelPlacement(target,camera,1000,700,viewport(1000,700));
 assert.ok(label);assert.equal(label.x,500);assert.equal(label.y,350);
});

test('large curved disks keep a stable centroid before the straight-line cutoff',()=>{
 const label=placeVisibleLabel({type:'disk',x:-3999500,y:350,r:4000000},viewport(1000,700));
 assert.ok(label.x>249.99&&label.x<250);
 assert.ok(Math.abs(label.y-350)<1e-5);
});

test('an overflowing negative circle labels the exterior side of its line',()=>{
 const outer=presets['(-1,2,2,3)'][0];
 const camera=cameraForCircle(outer,500,350,scaleFromBigInt(1n<<2000n));
 camera.anchorX={n:1n,d:1n};camera.anchorY={n:0n,d:1n};
 const label=projectedLabelPlacement(outer,camera,1000,700,viewport(1000,700));
 assert.ok(label);assert.equal(label.y,350);
 assert.ok(Math.abs(label.x-500-label.r-8)<1e-6);
 assert.ok(label.x-label.r>=500-1e-8);
});

for(const [name,x,y,axis] of [
 ['left',-300,200,'x'],['right',700,200,'x'],
 ['above',200,-300,'y'],['below',200,700,'y']
])test(`an outer center off-screen ${name} places its label directly opposite`,()=>{
 const shape={type:'disk',x,y,r:500,outside:true};
 const label=placeVisibleLabel(shape,rects);
 assert.ok(label);
 assert.equal(label[axis==='x'?'y':'x'],200);
 assert.ok((label[axis]-200)*(200-shape[axis])>0);
 assert.ok(Math.abs(Math.hypot(label.x-x,label.y-y)-500-label.r-8)<1e-6);
});

test('a diagonal off-screen outer center labels along the opposite ray',()=>{
 const shape={type:'disk',x:-300,y:-100,r:650,outside:true};
 const label=placeVisibleLabel(shape,rects);
 assert.ok(label);
 assert.ok(Math.abs((label.x-200)*300-(label.y-200)*500)<1e-5);
 assert.ok(Math.abs(Math.hypot(label.x-shape.x,label.y-shape.y)-650-label.r-8)<1e-6);
});
