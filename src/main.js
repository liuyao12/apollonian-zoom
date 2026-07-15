import {toFloat,createTree,generate,visibleTree} from './apollonianBigInt.js';
import {circleBoundaryPrimitive} from './circleRenderer.js';
import {presets} from './presets.js';
import {completeCurvatures,configurationFromCurvatures,parseCurvatures} from './customConfig.js';

const canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d');
const panel=document.getElementById('presets');
const factorToggle=document.getElementById('factor-toggle');
const homeButton=document.getElementById('home-button');
const customButton=document.getElementById('custom-button');
const customForm=document.getElementById('custom-form');
const customInput=document.getElementById('custom-curvatures');
const customCancel=document.getElementById('custom-cancel');
const customError=document.getElementById('custom-error');
const MIN_CIRCLE_RADIUS_PX=2;
const WHEEL_ZOOM_SENSITIVITY=.001;
const HOME_WHEEL_DELTA_PER_SECOND=600,HOME_MIN_DURATION_MS=400;
const HOME_RECENTER_DURATION_MS=650;
let current=Object.keys(presets)[0],currentConfig=presets[current],zoom=600,offsetX=0,offsetY=0,circles=[];
let root=createTree(currentConfig);
const customConfigs=[];
const pointers=new Map();let gesture=null;
let homeFrame=null;

const factorWorker=new Worker(new URL('./factorWorker.js',import.meta.url),{type:'module'});
const factorCache=new Map(),factorQueue=[],factorQueued=new Set();
let factorLabels=false,factorActive=null;

function pumpFactorQueue(){
 if(factorActive!==null||factorQueue.length===0)return;
 factorActive=factorQueue.shift();factorQueued.delete(factorActive);
 factorWorker.postMessage({value:factorActive});
}

function requestFactors(value){
 const key=value.toString();
 if(factorCache.has(key)||factorActive===key||factorQueued.has(key))return;
 factorQueue.push(key);factorQueued.add(key);pumpFactorQueue();
}

function resetFactorQueue(){factorQueue.length=0;factorQueued.clear();}

factorWorker.onmessage=e=>{
 const {value,terms}=e.data;
 factorCache.set(value,terms);factorActive=null;
 draw();pumpFactorQueue();
};

factorWorker.onerror=()=>{
 factorActive=null;resetFactorQueue();factorLabels=false;
 factorToggle.checked=false;factorToggle.disabled=true;
 draw();
};

factorToggle.onchange=()=>{
 factorLabels=factorToggle.checked;resetFactorQueue();draw();
};

function fitOuterFor(config,w,h){
 const outer=config.find(c=>c.b<0n)||config[0];
 const c=toFloat(outer);
 const z=0.42*Math.min(w,h)/c.r;
 return {zoom:z,offsetX:w/2-c.x*z,offsetY:h/2+c.y*z};
}

function drawThumbnail(canvasEl,config){
 const cctx=canvasEl.getContext('2d');
 cctx.fillStyle='white';cctx.fillRect(0,0,canvasEl.width,canvasEl.height);
 const cam=fitOuterFor(config,canvasEl.width,canvasEl.height);
 // Thumbnails only need a representative finite packing. Running the
 // viewport-driven infinite traversal six times here makes startup needlessly
 // expensive, especially for presets with large curvatures.
 const cs=generate(config,5);
 cctx.strokeStyle='black';
 for(const e of cs){
  const c=toFloat(e),x=cam.offsetX+c.x*cam.zoom,y=cam.offsetY-c.y*cam.zoom,r=c.r*cam.zoom;
  if(Number.isFinite(x+y+r)){cctx.beginPath();cctx.arc(x,y,r,0,2*Math.PI);cctx.stroke();}
 }
}

function renderCards(){
 panel.innerHTML='';
 function appendCard(name,config,id){
  const d=document.createElement('div');
  const t=document.createElement('canvas');t.width=130;t.height=100;t.className='thumb';
  const label=document.createElement('div');label.className='label';label.textContent=name;
  d.appendChild(t);d.appendChild(label);
  d.className='card'+(id===current?' selected':'');
  d.onclick=()=>{current=id;currentConfig=config;root=createTree(currentConfig);rebuild();renderCards();};
  panel.appendChild(d);drawThumbnail(t,config);
 }
 for(const name of Object.keys(presets))appendCard(name,presets[name],name);
 for(const entry of customConfigs)appendCard(entry.name,entry.config,entry.id);
}

function viewport(){return {left:(0-offsetX)/zoom,right:(canvas.width-offsetX)/zoom,top:offsetY/zoom,bottom:(offsetY-canvas.height)/zoom};}
function update(){resetFactorQueue();circles=visibleTree(root,viewport(),zoom,MIN_CIRCLE_RADIUS_PX);}
function fitOuter(){const c=fitOuterFor(currentConfig,canvas.width,canvas.height);zoom=c.zoom;offsetX=c.offsetX;offsetY=c.offsetY;}
function cancelHomeAnimation(){if(homeFrame!==null){cancelAnimationFrame(homeFrame);homeFrame=null;}}
function rebuild(){cancelHomeAnimation();fitOuter();update();draw();}
function resize(){const rect=canvas.getBoundingClientRect();canvas.width=Math.max(1,Math.round(rect.width));canvas.height=Math.max(1,Math.round(rect.height));rebuild();}
addEventListener('resize',resize);

function labelTerms(value){
 if(!factorLabels)return [value.toString()];
 const key=value.toString(),cached=factorCache.get(key);
 if(cached)return cached;
 requestFactors(value);return [key];
}

function rowWidth(terms,fontSize){
 ctx.font=fontSize+'px sans-serif';
 let width=terms.reduce((sum,term)=>sum+ctx.measureText(term).width,0);
 if(terms.length>1){
  const gap=fontSize*.09,dotSize=fontSize*.5;
  ctx.font=dotSize+'px sans-serif';
  width+=(terms.length-1)*(ctx.measureText('·').width+2*gap);
 }
 return width;
}

function layoutAtSize(terms,fontSize,r){
 const innerRadius=r*.8,lineHeight=fontSize*1.08,n=terms.length;
 const widths=Array.from({length:n},()=>Array(n+1).fill(0));
 for(let start=0;start<n;start++)for(let end=start+1;end<=n;end++)widths[start][end]=rowWidth(terms.slice(start,end),fontSize);

 for(let lineCount=1;lineCount<=n;lineCount++){
  const available=[];let fitsHeight=true;
  for(let row=0;row<lineCount;row++){
   const offset=(row-(lineCount-1)/2)*lineHeight;
   const edge=Math.abs(offset)+fontSize/2;
   if(edge>=innerRadius){fitsHeight=false;break;}
   available.push(2*Math.sqrt(innerRadius*innerRadius-edge*edge));
  }
  if(!fitsHeight)continue;
  function place(start,row){
   if(row===lineCount)return start===n?[]:null;
   const remaining=lineCount-row-1,maxEnd=n-remaining;
   for(let end=maxEnd;end>start;end--){
    if(widths[start][end]>available[row])continue;
    const rest=place(end,row+1);
    if(rest)return [{terms:terms.slice(start,end),width:widths[start][end]},...rest];
   }
   return null;
  }
  const rows=place(0,0);
  if(rows)return {fontSize,lineHeight,rows};
 }
 return null;
}

function drawFittedLabel(terms,x,y,r){
 let low=.5,high=Math.min(40,r*.48),layout=null;
 for(let i=0;i<12;i++){
  const size=(low+high)/2,candidate=layoutAtSize(terms,size,r);
  if(candidate){layout=candidate;low=size;}else high=size;
 }
 if(!layout)return;
 layout.rows.forEach((row,rowIndex)=>{
  const rowY=y+(rowIndex-(layout.rows.length-1)/2)*layout.lineHeight;
  let cursor=x-row.width/2;
  row.terms.forEach((term,termIndex)=>{
   if(termIndex){
    const gap=layout.fontSize*.09,dotSize=layout.fontSize*.5;
    cursor+=gap;ctx.font=dotSize+'px sans-serif';
    const dotWidth=ctx.measureText('·').width;
    ctx.fillText('·',cursor+dotWidth/2,rowY+layout.fontSize*.04);cursor+=dotWidth+gap;
   }
   ctx.font=layout.fontSize+'px sans-serif';
   const termWidth=ctx.measureText(term).width;
   ctx.fillText(term,cursor+termWidth/2,rowY);cursor+=termWidth;
  });
 });
}

function drawCircleBoundary(x,y,r){
 const boundary=circleBoundaryPrimitive(x,y,r,canvas.width,canvas.height);
 if(boundary.type==='none')return false;
 ctx.beginPath();
 if(boundary.type==='arc')ctx.arc(boundary.x,boundary.y,boundary.r,0,2*Math.PI);
 else{ctx.moveTo(boundary.x1,boundary.y1);ctx.lineTo(boundary.x2,boundary.y2);}
 ctx.stroke();return true;
}

function draw(){
 ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.strokeStyle='black';ctx.fillStyle='black';ctx.textAlign='center';ctx.textBaseline='middle';
 for(const e of circles){
  const c=toFloat(e),x=offsetX+c.x*zoom,y=offsetY-c.y*zoom,r=c.r*zoom;
  if(![x,y,r].every(Number.isFinite))continue;
  const boundaryVisible=drawCircleBoundary(x,y,r);
  if(c.b<0n&&boundaryVisible){ctx.font=Math.max(18,r*.25)+'px sans-serif';const d=r+Math.max(30,r*.2);ctx.fillText(c.b.toString(),x+d/Math.SQRT2,y-d/Math.SQRT2);}
  else if(c.b>0n&&r>10&&x>=0&&x<=canvas.width&&y>=0&&y<=canvas.height)drawFittedLabel(labelTerms(c.b),x,y,r);
 }
}

function zoomAt(oldX,oldY,newX,newY,factor){
 const nextZoom=zoom*factor;
 if(!Number.isFinite(nextZoom)||nextZoom<=0)return false;
 const wx=(oldX-offsetX)/zoom,wy=-(oldY-offsetY)/zoom;
 zoom=nextZoom;offsetX=newX-wx*zoom;offsetY=newY+wy*zoom;
 return true;
}

function animateHome(){
 cancelHomeAnimation();
 const target=fitOuterFor(currentConfig,canvas.width,canvas.height);
 const start={zoom,centerX:(canvas.width/2-offsetX)/zoom,centerY:(offsetY-canvas.height/2)/zoom};
 const end={zoom:target.zoom,centerX:(canvas.width/2-target.offsetX)/target.zoom,centerY:(target.offsetY-canvas.height/2)/target.zoom};
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){
  zoom=target.zoom;offsetX=target.offsetX;offsetY=target.offsetY;update();draw();return;
 }
 const started=performance.now(),logStart=Math.log(start.zoom),logEnd=Math.log(end.zoom);
 const zoomDistance=Math.abs(logEnd-logStart);
 // Match a steady, ordinary mouse-wheel pace (about six 100-unit notches per
 // second) using the same sensitivity as manual zooming.
 const zoomDuration=zoomDistance<1e-9?0:Math.max(HOME_MIN_DURATION_MS,
  zoomDistance/(WHEEL_ZOOM_SENSITIVITY*HOME_WHEEL_DELTA_PER_SECOND)*1000);
 const centerDistance=Math.hypot(end.centerX-start.centerX,end.centerY-start.centerY);
 const panDuration=centerDistance<1e-12?0:HOME_RECENTER_DURATION_MS;
 const duration=zoomDuration+panDuration;
 function step(now){
  const elapsed=now-started;
  let centerX=start.centerX,centerY=start.centerY;
  if(elapsed<zoomDuration){
   // Keep the viewed point centered while circles shrink at a steady rate.
   const t=elapsed/zoomDuration;
   zoom=Math.exp(logStart+(logEnd-logStart)*t);
  }else{
   // Once the home scale is reached, recenter the already-visible packing.
   zoom=end.zoom;
   const t=panDuration?Math.min(1,(elapsed-zoomDuration)/panDuration):1;
   const eased=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
   centerX=start.centerX+(end.centerX-start.centerX)*eased;
   centerY=start.centerY+(end.centerY-start.centerY)*eased;
  }
  offsetX=canvas.width/2-centerX*zoom;offsetY=canvas.height/2+centerY*zoom;
  update();draw();
  if(elapsed<duration)homeFrame=requestAnimationFrame(step);
  else{zoom=target.zoom;offsetX=target.offsetX;offsetY=target.offsetY;homeFrame=null;update();draw();}
 }
 homeFrame=requestAnimationFrame(step);
}

homeButton.addEventListener('click',animateHome);

function setCustomForm(open){
 customButton.setAttribute('aria-expanded',String(open));customForm.hidden=!open;
 if(open){customError.textContent='';customInput.focus();}
}
customButton.addEventListener('click',()=>setCustomForm(customForm.hidden));
customCancel.addEventListener('click',()=>setCustomForm(false));
customForm.addEventListener('submit',e=>{
 e.preventDefault();
 try{
  const bends=completeCurvatures(parseCurvatures(customInput.value));
  const name=`(${bends.join(',')})`,id=`custom:${name}`;
  let entry=customConfigs.find(candidate=>candidate.id===id);
  if(!entry){entry={id,name,config:configurationFromCurvatures(bends)};customConfigs.push(entry);}
  currentConfig=entry.config;current=entry.id;
  root=createTree(currentConfig);setCustomForm(false);rebuild();renderCards();
 }catch(error){customError.textContent=error.message;}
});

canvas.addEventListener('wheel',e=>{
 e.preventDefault();cancelHomeAnimation();const rect=canvas.getBoundingClientRect();
 const mx=e.clientX-rect.left,my=e.clientY-rect.top;
 if(zoomAt(mx,my,mx,my,Math.exp(-e.deltaY*WHEEL_ZOOM_SENSITIVITY))){update();draw();}
},{passive:false});

function currentGesture(){
 const points=[...pointers.values()];
 if(points.length===0)return null;
 if(points.length===1)return {type:'pan',x:points[0].x,y:points[0].y};
 const a=points[0],b=points[1];
 return {type:'pinch',x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};
}

canvas.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'&&e.button!==0)return;
 e.preventDefault();cancelHomeAnimation();canvas.setPointerCapture(e.pointerId);
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});gesture=currentGesture();
 canvas.classList.add('interacting');
});

canvas.addEventListener('pointermove',e=>{
 if(!pointers.has(e.pointerId))return;
 e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 const next=currentGesture();let changed=false;
 if(gesture?.type==='pan'&&next?.type==='pan'){
  offsetX+=next.x-gesture.x;offsetY+=next.y-gesture.y;changed=true;
 }else if(gesture?.type==='pinch'&&next?.type==='pinch'){
  const rect=canvas.getBoundingClientRect();
  changed=zoomAt(gesture.x-rect.left,gesture.y-rect.top,next.x-rect.left,next.y-rect.top,next.distance/gesture.distance);
 }
 gesture=next;if(changed){update();draw();}
});

function endPointer(e){
 if(!pointers.delete(e.pointerId))return;
 if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
 gesture=currentGesture();if(pointers.size===0)canvas.classList.remove('interacting');
}
canvas.addEventListener('pointerup',endPointer);
canvas.addEventListener('pointercancel',endPointer);
canvas.addEventListener('lostpointercapture',endPointer);

resize();renderCards();
