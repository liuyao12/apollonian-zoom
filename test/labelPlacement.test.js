import test from 'node:test';
import assert from 'node:assert/strict';
import {placeVisibleLabel,unobstructedLabelRects} from '../src/labelPlacement.js';
import {cameraForCircle,projectedLabelPlacement,scaleFromBigInt,visibleTreeProjected} from '../src/exactViewport.js';
import {presets} from '../src/presets.js';

const rects=unobstructedLabelRects(400,400);
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

test('an enclosing-circle label stays outside its disk',()=>{
 const shape={type:'disk',x:200,y:200,r:150,outside:true};
 const label=placeVisibleLabel(shape,rects);
 assert.ok(label);
 assert.ok(Math.hypot(label.x-shape.x,label.y-shape.y)-label.r>=shape.r-1e-8);
});

test('label space excludes controls and inspector panels',()=>{
 const obstacle={left:100,right:350,top:50,bottom:300};
 const free=unobstructedLabelRects(400,400,[obstacle]);
 const label=placeVisibleLabel({type:'rectangle'},free);
 assert.ok(label);
 assert.ok(label.x+label.r<=obstacle.left||label.x-label.r>=obstacle.right||
  label.y+label.r<=obstacle.top||label.y-label.r>=obstacle.bottom);
});

test('overflowing tangent circles label their respective visible sides',()=>{
 const config=presets['(-1,2,2,3)'];
 const camera=cameraForCircle(config[0],500,350,scaleFromBigInt(1n<<2000n));
 const free=unobstructedLabelRects(1000,700);
 const left=projectedLabelPlacement(config[1],camera,1000,700,free);
 const right=projectedLabelPlacement(config[2],camera,1000,700,free);
 assert.ok(left&&right);
 assert.ok(left.x+left.r<=500+1e-8);
 assert.ok(right.x-right.r>=500-1e-8);
});

test('a viewport entirely inside a circle retains its exact number',()=>{
 const config=presets['(-1,2,2,3)'],target=config[1];
 const camera=cameraForCircle(target,500,350,scaleFromBigInt(1n<<2000n));
 const visible=visibleTreeProjected(config,camera,1000,700,2);
 assert.ok(visible.some(c=>c.b===target.b&&c.bx.n===target.bx.n));
 const label=projectedLabelPlacement(target,camera,1000,700,unobstructedLabelRects(1000,700));
 assert.ok(label);assert.equal(label.x,500);assert.equal(label.y,350);
});
