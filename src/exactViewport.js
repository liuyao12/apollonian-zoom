import {circle,reflect} from './apollonianBigInt.js';

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
 const exponent=power+nShift-dShift;
 if(exponent>1024)return sign*Infinity;
 if(exponent<-1075)return sign*0;
 return sign*leading*2**exponent;
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
function circleBoundaryIntersects(c,camera,width,height,margin=0){
 const p=projectCircle(c,camera);
 if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.r)||p.r>1e9){
  return giantCircleLine(c,camera,width,height,margin).type!=='none';
 }
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

export function traversalStage(config,blockedIndex=null,parent=null,bridgeCircles=[]){
 return {config,blockedIndex,parent,bridgeCircles};
}

export function stageNeedsParent(stage,camera,width,height,margin=Math.hypot(width,height)*.5){
 return stage.blockedIndex!==null&&
  valleyCorners(stage.config,stage.blockedIndex).some(point=>pointInsideExpandedViewport(point,camera,width,height,margin));
}

// This traversal is intentionally stateless. Deep branches from old frames are
// not retained, so memory tracks the current viewport rather than zoom history.
export function visibleTreeProjected(config,camera,width,height,minRadiusPx=2,blockedIndex=null,bridgeCircles=[],trackTangencies=false){
 const result=[],seen=new Set(),records=new Map(),touching=new Map(),stack=[];
 let nextStage=null,nextStageDepth=0,nextStageDistance=Infinity;
 const stageStepDepth=18,stageMargin=Math.hypot(width,height);
 function radiusPixels(c){return camera.scale.mantissa*scaledRatioToNumber(1n,abs(c.b),camera.scale.exponent);}
 function addCircle(c){
  if(radiusPixels(c)<minRadiusPx||!circleBoundaryIntersects(c,camera,width,height,minRadiusPx))return;
  const key=circleKey(c);
  if(!seen.has(key)){
   const record=circle(c);seen.add(key);records.set(key,record);result.push(record);
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
 bridgeCircles.forEach(addCircle);
 config.forEach(addCircle);registerTangencies(config);
 for(let i=0;i<4;i++)if(i!==blockedIndex)stack.push({
  config:reflect(config,i),replaced:i,depth:1,safeStage:null,parentNode:null
 });
 while(stack.length){
  const node=stack.pop(),candidate=node.config[node.replaced];
  if(radiusPixels(candidate)<minRadiusPx)continue;
  const bounds=projectedBounds(valleyPoints(node.config,node.replaced),camera);
  if(!boundsIntersect(bounds,width,height,minRadiusPx))continue;
  let safeStage=node.safeStage;
  if(node.depth>=stageStepDepth&&bounds.left<=width/2&&bounds.right>=width/2&&
   bounds.top<=height/2&&bounds.bottom>=height/2&&
   valleyCornersClear(node.config,node.replaced,camera,width,height,stageMargin)){
   safeStage={config:node.config,blockedIndex:node.replaced,depth:node.depth,pathNode:node};
  }
  addCircle(candidate);registerTangencies(node.config);
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
export function giantCircleLine(c,camera,width,height,tolerance=.25){
 const center=pointForCircle(c),dx=sub(camera.anchorX,center.x),dy=sub(camera.anchorY,center.y),r=radiusFraction(c);
 const exponent=Math.max(binaryExponent(dx),binaryExponent(dy),binaryExponent(r));
 const dxn=scaledRatioToNumber(dx.n,dx.d,-exponent),dyn=scaledRatioToNumber(dy.n,dy.d,-exponent);
 const distance=Math.hypot(dxn,dyn),rn=scaledRatioToNumber(r.n,r.d,-exponent);
 if(!Number.isFinite(distance)||distance===0||!Number.isFinite(rn))return {type:'none'};
 const f=sub(add(square(dx),square(dy)),square(r));
 const signed=camera.scale.mantissa*scaledRatioToNumber(f.n,f.d,camera.scale.exponent-exponent)/(distance+rn);
 if(!Number.isFinite(signed))return {type:'none'};
 const nx=dxn/distance,ny=-dyn/distance;
 const extent=Math.abs(nx)*width/2+Math.abs(ny)*height/2;
 const centerX=width/2,centerY=height/2;
 const anchorDistance=(camera.screenX-centerX)*nx+(camera.screenY-centerY)*ny;
 const lineDistance=anchorDistance-signed;
 if(Math.abs(lineDistance)>extent+tolerance)return {type:'none'};
 const qx=centerX+lineDistance*nx,qy=centerY+lineDistance*ny;
 const tx=-ny,ty=nx,halfLength=Math.hypot(width,height)+tolerance;
 return {type:'line',x1:qx-tx*halfLength,y1:qy-ty*halfLength,x2:qx+tx*halfLength,y2:qy+ty*halfLength};
}
