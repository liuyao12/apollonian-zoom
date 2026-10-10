import {circle,reflect} from './apollonianBigInt.js';
import {ARC_LINE_TOLERANCE_PX,circleBoundaryPrimitive} from './circleRenderer.js';
import {placeVisibleLabel} from './labelPlacement.js?v=exterior-fixed-size';

const TAU=2*Math.PI,ANGLE_EPSILON=1e-10;

function abs(n){return n<0n?-n:n;}
// Projection only needs an exact numerator/denominator ratio, not a reduced
// fraction. Avoiding GCDs here is what keeps very large BigInt views interactive.
function fraction(n,d=1n){
 if(d===0n)throw new Error('Division by zero');
 if(d<0n){n=-n;d=-d;}
 if(n===0n)return {n:0n,d:1n};
 return {n,d};
}
function add(a,b){return fraction(a.n*b.d+b.n*a.d,a.d*b.d);}
function sub(a,b){return fraction(a.n*b.d-b.n*a.d,a.d*b.d);}
function mul(a,b){return fraction(a.n*b.n,a.d*b.d);}
function div(a,b){return fraction(a.n*b.d,a.d*b.n);}
function divInt(a,n){return fraction(a.n,a.d*n);}
function square(a){return mul(a,a);}

function bitLength(n){return abs(n).toString(2).length;}
function binaryExponent(a){return a.n===0n?-Infinity:bitLength(a.n)-bitLength(a.d);}

// Convert only after applying the binary scale. Taking equally-sized leading
// chunks prevents either BigInt operand from overflowing a Number first.
export function scaledRatioToNumber(n,d,power=0){
 if(n===0n)return 0;
 let sign=1;if(n<0n){sign=-1;n=-n;}if(d<0n){sign=-sign;d=-d;}
 const nBits=bitLength(n),dBits=bitLength(d);
 const nShift=Math.max(0,nBits-54),dShift=Math.max(0,dBits-54);
 const leading=Number(n>>BigInt(nShift))/Number(d>>BigInt(dShift));
 const adjustment=Math.floor(Math.log2(leading));
 const exponent=power+nShift-dShift+adjustment;
 if(exponent>1024)return sign*Infinity;
 if(exponent<-1075)return sign*0;
 return sign*(leading/2**adjustment)*2**exponent;
}

function normalizeScale(scale){
 if(!Number.isFinite(scale.mantissa)||scale.mantissa<=0)throw new Error('Invalid camera scale');
 const shift=Math.floor(Math.log2(scale.mantissa));
 scale.mantissa/=2**shift;scale.exponent+=shift;
 return scale;
}

export function scaleFromNumber(value){
 if(!Number.isFinite(value)||value<=0)throw new Error('Invalid camera scale');
 const exponent=Math.floor(Math.log2(value));
 return {mantissa:value/2**exponent,exponent};
}

export function scaleFromBigInt(value,multiplier=1){
 value=abs(BigInt(value));
 if(value===0n||!Number.isFinite(multiplier)||multiplier<=0)throw new Error('Invalid camera scale');
 const exponent=bitLength(value)-1;
 return normalizeScale({mantissa:scaledRatioToNumber(value,1n,-exponent)*multiplier,exponent});
}

export function scaleLog(scale){return Math.log(scale.mantissa)+scale.exponent*Math.LN2;}
export function multiplyScale(scale,factor){return normalizeScale({mantissa:scale.mantissa*factor,exponent:scale.exponent});}

export function centerFraction(c,axis){
 const value=axis==='x'?c.bx:c.by;
 return fraction(value.n,value.d*c.b);
}
function radiusFraction(c){return fraction(1n,abs(c.b));}
function pointForCircle(c){return {x:centerFraction(c,'x'),y:centerFraction(c,'y')};}

export function cameraForCircle(c,screenX,screenY,scale){
 const point=pointForCircle(c);
 return {anchorX:point.x,anchorY:point.y,screenX,screenY,scale:{...scale}};
}

// Decode the actual binary value of an input coordinate, not its decimal
// spelling. Only pixel coordinates and the scale mantissa use doubles.
function numberFraction(value){
 if(!Number.isFinite(value))throw new Error('Invalid screen coordinate');
 if(value===0)return fraction(0n);
 const buffer=new DataView(new ArrayBuffer(8));buffer.setFloat64(0,value);
 const bits=buffer.getBigUint64(0),field=Number((bits>>52n)&2047n);
 let n=bits&((1n<<52n)-1n);
 if(field)n|=1n<<52n;
 if(bits>>63n)n=-n;
 const power=field?field-1075:-1074;
 return power>=0?fraction(n<<BigInt(power)):fraction(n,1n<<BigInt(-power));
}
function pixelToWorld(value,scale){
 const p=numberFraction(value),m=numberFraction(scale.mantissa);
 return scale.exponent>=0?fraction(p.n*m.d,p.d*m.n*(1n<<BigInt(scale.exponent))):
  fraction(p.n*m.d*(1n<<BigInt(-scale.exponent)),p.d*m.n);
}
export function worldPointAt(camera,x,y){
 return {x:add(camera.anchorX,pixelToWorld(x-camera.screenX,camera.scale)),
  y:sub(camera.anchorY,pixelToWorld(y-camera.screenY,camera.scale))};
}
function reducedAnchor(a){
 let n=abs(a.n),d=a.d;
 while(d){const r=n%d;n=d;d=r;}
 return fraction(a.n/n,a.d/n);
}
export function zoomCameraAt(camera,oldX,oldY,newX,newY,factor){
 if(!Number.isFinite(factor)||factor<=0)return false;
 const point=worldPointAt(camera,oldX,oldY);
 const scale=multiplyScale({...camera.scale},factor);
 // Keep the pivot exactly, including its fractional screen offset. Rounding
 // even at 64 guard bits would become visible after another 20 zoom orders.
 // A stationary pivot reuses its rational; only a moving pivot needs a GCD.
 camera.anchorX=oldX===camera.screenX?camera.anchorX:reducedAnchor(point.x);
 camera.anchorY=oldY===camera.screenY?camera.anchorY:reducedAnchor(point.y);
 camera.screenX=newX;camera.screenY=newY;camera.scale=scale;
 return true;
}

function projectCoordinate(value,anchor,screen,scale,flip=false){
 const delta=sub(value,anchor);
 const pixels=scale.mantissa*scaledRatioToNumber(delta.n,delta.d,scale.exponent);
 return screen+(flip?-pixels:pixels);
}

export function projectPoint(point,camera){
 return {
  x:projectCoordinate(point.x,camera.anchorX,camera.screenX,camera.scale),
  y:projectCoordinate(point.y,camera.anchorY,camera.screenY,camera.scale,true)
 };
}

export function projectCircle(c,camera){
 const center=projectPoint(pointForCircle(c),camera);
 const r=camera.scale.mantissa*scaledRatioToNumber(1n,abs(c.b),camera.scale.exponent);
 return {...center,r,b:c.b};
}

export function reanchorCamera(camera,c,screenPoint=projectCircle(c,camera)){
 const point=pointForCircle(c);
 camera.anchorX=point.x;camera.anchorY=point.y;
 camera.screenX=screenPoint.x;camera.screenY=screenPoint.y;
}

function circleCardinalPoints(c){
 const center=pointForCircle(c),r=radiusFraction(c);
 return [
  {x:add(center.x,r),y:center.y},{x:center.x,y:add(center.y,r)},
  {x:sub(center.x,r),y:center.y},{x:center.x,y:sub(center.y,r)}
 ];
}

function tangencyPoint(a,b){
 const bend=a.b+b.b;
 return {x:divInt(add(a.bx,b.bx),bend),y:divInt(add(a.by,b.by),bend)};
}

function positiveAngle(angle){angle%=TAU;return angle<0?angle+TAU:angle;}
function ccwDistance(from,to){return positiveAngle(to-from);}
function angleOnCcwArc(angle,start,end){return ccwDistance(start,angle)<=ccwDistance(start,end)+ANGLE_EPSILON;}

function vectorAngle(point,center){
 const dx=sub(point.x,center.x),dy=sub(point.y,center.y);
 const exponent=Math.max(binaryExponent(dx),binaryExponent(dy));
 const x=scaledRatioToNumber(dx.n,dx.d,-exponent);
 const y=scaledRatioToNumber(dy.n,dy.d,-exponent);
 return positiveAngle(Math.atan2(y,x));
}

function addArcPoints(points,c,startPoint,endPoint,viaPoint){
 const center=pointForCircle(c);
 let start=vectorAngle(startPoint,center),end=vectorAngle(endPoint,center),via=vectorAngle(viaPoint,center);
 if(!angleOnCcwArc(via,start,end)){const swap=start;start=end;end=swap;}
 points.push(startPoint,endPoint,viaPoint);
 const cardinals=circleCardinalPoints(c);
 [0,Math.PI/2,Math.PI,3*Math.PI/2].forEach((angle,index)=>{
  if(angleOnCcwArc(angle,start,end))points.push(cardinals[index]);
 });
}

function valleyPoints(config,replaced){
 const boundary=config.filter((_,i)=>i!==replaced);
 const tangencies=[
  tangencyPoint(boundary[0],boundary[1]),
  tangencyPoint(boundary[0],boundary[2]),
  tangencyPoint(boundary[1],boundary[2])
 ];
 if(!boundary.some(c=>c.b<0n))return tangencies;
 const candidate=config[replaced],points=[];
 for(let i=0;i<3;i++){
  const others=[0,1,2].filter(j=>j!==i);
  addArcPoints(points,boundary[i],tangencyPoint(boundary[i],boundary[others[0]]),
   tangencyPoint(boundary[i],boundary[others[1]]),tangencyPoint(boundary[i],candidate));
 }
 return points;
}

function projectedBounds(points,camera){
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 for(const point of points){
  const p=projectPoint(point,camera);
  if(Number.isNaN(p.x)||Number.isNaN(p.y))return {left:-Infinity,right:Infinity,top:-Infinity,bottom:Infinity};
  left=Math.min(left,p.x);right=Math.max(right,p.x);top=Math.min(top,p.y);bottom=Math.max(bottom,p.y);
 }
 return {left,right,top,bottom};
}
function boundsIntersect(bounds,width,height,margin=0){
 return !(bounds.right< -margin||bounds.left>width+margin||bounds.bottom< -margin||bounds.top>height+margin);
}
function circleBounds(c,camera){return projectedBounds(circleCardinalPoints(c),camera);}
function circleKey(c){return `${c.b},${c.bx.n}/${c.bx.d},${c.by.n}/${c.by.d}`;}
function circleLooksStraight(c,camera,width,height,tolerance=ARC_LINE_TOLERANCE_PX){
 const radius=camera.scale.mantissa*scaledRatioToNumber(1n,abs(c.b),camera.scale.exponent);
 const diagonal=Math.hypot(width,height);
 // For the linearized exact circle equation, the omitted quadratic term
 // is at most diagonal^2/4 within the viewport. This conservative threshold
 // bounds its boundary displacement by tolerance, including off-center arcs.
 return radius>=diagonal/2+diagonal*diagonal/(8*tolerance);
}
function circleBoundaryIntersects(c,camera,width,height,margin=0){
 if(circleLooksStraight(c,camera,width,height))
  return giantCircleLine(c,camera,width,height,margin+ARC_LINE_TOLERANCE_PX).type!=='none';
 const p=projectCircle(c,camera);
 const left=-margin,right=width+margin,top=-margin,bottom=height+margin;
 const nearX=Math.max(left,Math.min(right,p.x)),nearY=Math.max(top,Math.min(bottom,p.y));
 const nearest=Math.hypot(p.x-nearX,p.y-nearY);
 const farthest=Math.max(
  Math.hypot(p.x-left,p.y-top),Math.hypot(p.x-right,p.y-top),
  Math.hypot(p.x-left,p.y-bottom),Math.hypot(p.x-right,p.y-bottom)
 );
 return nearest<=p.r+margin&&farthest>=Math.max(0,p.r-margin);
}
function valleyCorners(config,replaced){
 const boundary=config.filter((_,i)=>i!==replaced);
 return [
  tangencyPoint(boundary[0],boundary[1]),
  tangencyPoint(boundary[0],boundary[2]),
  tangencyPoint(boundary[1],boundary[2])
 ];
}
function pointInsideExpandedViewport(point,camera,width,height,margin){
 const p=projectPoint(point,camera);
 return Number.isFinite(p.x)&&Number.isFinite(p.y)&&
  p.x>=-margin&&p.x<=width+margin&&p.y>=-margin&&p.y<=height+margin;
}
function valleyCornersClear(config,replaced,camera,width,height,margin){
 return valleyCorners(config,replaced).every(point=>!pointInsideExpandedViewport(point,camera,width,height,margin));
}
function valleyContainsViewport(config,replaced,camera,width,height,margin){
 const point=worldPointAt(camera,width/2,height/2);
 for(let i=0;i<4;i++)if(i!==replaced){
  const c=config[i],center=pointForCircle(c);
  const difference=sub(add(square(sub(point.x,center.x)),square(sub(point.y,center.y))),square(radiusFraction(c)));
  if(c.b>0n?difference.n<=0n:difference.n>=0n)return false;
  if(circleBoundaryIntersects(c,camera,width,height,margin))return false;
 }
 return true;
}

// At a tangency, a whole infinite cusp can become thinner than a pixel.
// Clip its local exterior/interior half-planes instead of walking millions
// of circles whose visible arcs coincide with the two ancestor boundaries.
function valleyIndistinguishable(config,replaced,camera,width,height){
 const tolerance=ARC_LINE_TOLERANCE_PX/4;
 let polygon=[{x:-2,y:-2},{x:width+2,y:-2},{x:width+2,y:height+2},{x:-2,y:height+2}];
 const normals=[];
 for(let i=0;i<4;i++)if(i!==replaced){
  const c=config[i];
  if(!circleLooksStraight(c,camera,width,height,tolerance))continue;
  const tangent=localCircleTangent(c,camera,width,height);
  if(!tangent){
   if(c.b>0n&&localCircleEquation(c,camera,width,height).f.n<0n)return true;
   continue;
  }
  normals.push({x:tangent.nx,y:tangent.ny});
  const direction=c.b>0n?1:-1;
  const offset=direction*tangent.signed+tolerance;
  if(offset===Infinity)continue;
  if(offset===-Infinity)return true;
  const value=p=>direction*(tangent.nx*(p.x-width/2)+tangent.ny*(p.y-height/2))+offset;
  const clipped=[];
  for(let j=0;j<polygon.length;j++){
   const a=polygon[j],b=polygon[(j+1)%polygon.length],va=value(a),vb=value(b);
   if(va>=0)clipped.push(a);
   if((va>=0)!==(vb>=0)){
    const t=va/(va-vb);clipped.push({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});
   }
  }
  polygon=clipped;
  if(!polygon.length)return true;
 }
 if(normals.length<2)return false;
 return [...normals,{x:1,y:0},{x:0,y:1}].some(normal=>{
  const values=polygon.map(p=>normal.x*p.x+normal.y*p.y);
  return Math.max(...values)-Math.min(...values)<ARC_LINE_TOLERANCE_PX;
 });
}

export function traversalStage(config,blockedIndex=null,parent=null,bridgeCircles=[]){
 return {config,blockedIndex,parent,bridgeCircles};
}

export function stageNeedsParent(stage,camera,width,height,margin=Math.hypot(width,height)*.5){
 return stage.blockedIndex!==null&&!valleyContainsViewport(stage.config,stage.blockedIndex,camera,width,height,margin);
}

// This traversal is intentionally stateless. Deep branches from old frames are
// not retained, so memory tracks the current viewport rather than zoom history.
export function visibleTreeProjected(config,camera,width,height,minRadiusPx=2,blockedIndex=null,bridgeCircles=[],trackTangencies=false){
 const result=[],seen=new Set(),records=new Map(),touching=new Map(),stack=[];
 let nextStage=null,nextStageDepth=0,nextStageDistance=Infinity;
 const stageStepDepth=18,stageMargin=Math.hypot(width,height);
 function radiusPixels(c){return camera.scale.mantissa*scaledRatioToNumber(1n,abs(c.b),camera.scale.exponent);}
 function addCircle(c,configuration=null){
  if(radiusPixels(c)<minRadiusPx)return;
  if(!circleBoundaryIntersects(c,camera,width,height,minRadiusPx)){
   // An off-screen boundary can still leave its entire disk on screen.
   // Keep that circle so zooming into its interior does not lose its label.
   if(c.b<0n||localCircleEquation(c,camera,width,height).f.n>=0n)return;
  }
  const key=circleKey(c);
  if(!seen.has(key)){
   const record=circle(c);record.configuration=configuration;
   seen.add(key);records.set(key,record);result.push(record);
  }else if(configuration&&!records.get(key).configuration){
   records.get(key).configuration=configuration;
  }
 }
 function registerTangencies(q){
  if(!trackTangencies)return;
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
   const a=circleKey(q[i]),b=circleKey(q[j]);
   if(!touching.has(a))touching.set(a,new Map());
   if(!touching.has(b))touching.set(b,new Map());
   touching.get(a).set(b,q[j].b);touching.get(b).set(a,q[i].b);
  }
 }
 bridgeCircles.forEach(c=>addCircle(c));
 config.forEach(c=>addCircle(c,config));registerTangencies(config);
 for(let i=0;i<4;i++)if(i!==blockedIndex)stack.push({
  config:reflect(config,i),replaced:i,depth:1,safeStage:null,parentNode:null
 });
 while(stack.length){
  const node=stack.pop(),candidate=node.config[node.replaced];
  if(radiusPixels(candidate)<minRadiusPx)continue;
  const bounds=projectedBounds(valleyPoints(node.config,node.replaced),camera);
  if(!boundsIntersect(bounds,width,height,minRadiusPx))continue;
  if(valleyIndistinguishable(node.config,node.replaced,camera,width,height))continue;
  let safeStage=node.safeStage;
  if(node.depth>=stageStepDepth&&bounds.left<=width/2&&bounds.right>=width/2&&
   bounds.top<=height/2&&bounds.bottom>=height/2&&
   valleyCornersClear(node.config,node.replaced,camera,width,height,stageMargin)&&
   valleyContainsViewport(node.config,node.replaced,camera,width,height,stageMargin)){
   safeStage={config:node.config,blockedIndex:node.replaced,depth:node.depth,pathNode:node};
  }
  addCircle(candidate,node.config);registerTangencies(node.config);
  if(safeStage&&candidate.b>0n){
   const p=projectCircle(candidate,camera);
   if(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.r)&&p.r>=minRadiusPx){
    const distance=Math.hypot(p.x-width/2,p.y-height/2);
    if(safeStage.depth>nextStageDepth||(safeStage.depth===nextStageDepth&&distance<nextStageDistance)){
     nextStage=safeStage;nextStageDepth=safeStage.depth;nextStageDistance=distance;
    }
   }
  }
  for(let i=0;i<4;i++)if(i!==node.replaced)stack.push({
   config:reflect(node.config,i),replaced:i,depth:node.depth+1,safeStage,parentNode:node
  });
 }
 if(trackTangencies)for(const [key,record] of records)
 record.neighborBends=[...(touching.get(key)||[])].filter(([neighbor])=>seen.has(neighbor)).map(([,bend])=>bend);
 if(nextStage){
  const bridges=new Map();
  for(let node=nextStage.pathNode;node;node=node.parentNode){
   for(const c of node.config)if(radiusPixels(c)>=minRadiusPx&&
    circleBoundaryIntersects(c,camera,width,height,minRadiusPx))bridges.set(circleKey(c),c);
  }
  nextStage={config:nextStage.config,blockedIndex:nextStage.blockedIndex,bridgeCircles:[...bridges.values()]};
 }
 Object.defineProperty(result,'nextStage',{value:nextStage});
 return result;
}

// Compute a visually indistinguishable tangent line without ever constructing
// the enormous screen-space center or radius of an ancestor circle.
function localCircleEquation(c,camera,width,height){
 const anchor=worldPointAt(camera,width/2,height/2);
 const center=pointForCircle(c),dx=sub(anchor.x,center.x),dy=sub(anchor.y,center.y),r=radiusFraction(c);
 const f=sub(add(square(dx),square(dy)),square(r));
 return {dx,dy,r,f};
}
function localCircleTangent(c,camera,width,height){
 const {dx,dy,r,f}=localCircleEquation(c,camera,width,height);
 const exponent=Math.max(binaryExponent(dx),binaryExponent(dy),binaryExponent(r));
 const dxn=scaledRatioToNumber(dx.n,dx.d,-exponent),dyn=scaledRatioToNumber(dy.n,dy.d,-exponent);
 const distance=Math.hypot(dxn,dyn),rn=scaledRatioToNumber(r.n,r.d,-exponent);
 if(!Number.isFinite(distance)||distance===0||!Number.isFinite(rn))return null;
 const signed=camera.scale.mantissa*scaledRatioToNumber(f.n,f.d,camera.scale.exponent-exponent)/(2*distance);
 const nx=dxn/distance,ny=-dyn/distance;
 return {nx,ny,signed};
}
export function giantCircleLine(c,camera,width,height,tolerance=.25){
 const {dx,dy,f}=localCircleEquation(c,camera,width,height);
 // In viewport-local pixel coordinates the exact linear equation is
 // a*x + b*y + f = 0. Its coefficients and edge intersections stay rational;
 // no huge screen-space center, radius, square root, or subtraction is used.
 const a=mul(dx,pixelToWorld(2,camera.scale)),b=mul(dy,pixelToWorld(-2,camera.scale));
 const left=numberFraction(-width/2-tolerance),right=numberFraction(width/2+tolerance);
 const top=numberFraction(-height/2-tolerance),bottom=numberFraction(height/2+tolerance);
 const compare=(u,v)=>u.n*v.d-v.n*u.d;
 const points=[];
 function addPoint(x,y){
  if(compare(x,left)<0n||compare(x,right)>0n||compare(y,top)<0n||compare(y,bottom)>0n)return;
  if(points.some(p=>compare(p.x,x)===0n&&compare(p.y,y)===0n))return;
  points.push({x,y});
 }
 if(b.n!==0n)for(const x of [left,right])addPoint(x,div(sub(fraction(0n),add(f,mul(a,x))),b));
 if(a.n!==0n)for(const y of [top,bottom])addPoint(div(sub(fraction(0n),add(f,mul(b,y))),a),y);
 if(points.length<2)return {type:'none'};
 const screen=p=>({x:width/2+scaledRatioToNumber(p.x.n,p.x.d),y:height/2+scaledRatioToNumber(p.y.n,p.y.d)});
 const start=screen(points[0]),end=screen(points[1]);
 return {type:'line',x1:start.x,y1:start.y,x2:end.x,y2:end.y};
}

export function projectedBoundary(c,camera,width,height,tolerance=ARC_LINE_TOLERANCE_PX){
 // Use the exact implicit circle equation before cancellation can erase
 // the boundary location. Curvature becomes a line only below this error.
 if(circleLooksStraight(c,camera,width,height,tolerance))
  return giantCircleLine(c,camera,width,height,tolerance);
 const p=projectCircle(c,camera);
 return circleBoundaryPrimitive(p.x,p.y,p.r,width,height);
}

export function projectedLabelPlacement(c,camera,width,height,rects,labelRadius=48){
 if(!circleLooksStraight(c,camera,width,height)){
  const p=projectCircle(c,camera);
  return placeVisibleLabel({type:'disk',...p,outside:c.b<0n,labelRadius},rects);
 }
 const tangent=localCircleTangent(c,camera,width,height);
 if(!tangent||!Number.isFinite(tangent.signed)){
  if(c.b>0n&&localCircleEquation(c,camera,width,height).f.n<0n)
   return placeVisibleLabel({type:'rectangle'},rects);
  return null;
 }
 const direction=c.b<0n?1:-1;
 const nx=direction*tangent.nx,ny=direction*tangent.ny;
 return placeVisibleLabel({type:'halfPlane',nx,ny,outside:c.b<0n,labelRadius,
  offset:direction*tangent.signed-nx*width/2-ny*height/2},rects);
}
