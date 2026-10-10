import {toFloat,generate} from './apollonianBigInt.js';
import {descendConfiguration,exactCircleValues} from './deepNavigation.js';
import {presets} from './presets.js';
import {completeCurvatures,configurationFromCurvatures,parseCurvatures} from './customConfig.js';
import {cameraForCircle,projectedBoundary,projectedLabelPlacement,projectCircle,scaleFromBigInt,scaleFromNumber,scaleLog,stageNeedsParent,traversalStage,visibleTreeProjected,zoomCameraAt} from './exactViewport.js';
import {admissibleResidues,residueFromMod3Mod8,residueMod} from './residueClasses.js';
import {randomRootCurvatures} from './randomConfig.js';

const canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d');
const panel=document.getElementById('presets');
const factorToggle=document.getElementById('factor-toggle');
const homeButton=document.getElementById('home-button');
const randomButton=document.getElementById('random-button');
const customButton=document.getElementById('custom-button');
const customForm=document.getElementById('custom-form');
const customInput=document.getElementById('custom-curvatures');
const customCancel=document.getElementById('custom-cancel');
const customError=document.getElementById('custom-error');
const residueButtons=document.getElementById('residue-buttons');
const inspector=document.getElementById('inspector'),exactValue=document.getElementById('exact-value');
const zoomStatus=document.getElementById('zoom-status');
let selectedCircle=null,homeScaleLog=0,pointerStart=null;
const MIN_CIRCLE_RADIUS_PX=2;
const PRIME_GLOW_MIN_RADIUS_PX=5;
const RESIDUE_PALETTE=['#1565c0','#d35400','#14805e','#b13b72','#6f42c1','#8c564b','#00838f','#c62828'];
const WHEEL_ZOOM_SENSITIVITY=.001;
const HOME_WHEEL_DELTA_PER_SECOND=600,HOME_MIN_DURATION_MS=400;
const HOME_RECENTER_DURATION_MS=650;
let current=Object.keys(presets)[0],currentConfig=presets[current],viewStage=traversalStage(currentConfig),circles=[],camera=null;
let allowedResidues=new Set(),residueColors=new Map(),selectedResidues=new Set();
const customConfigs=[];
const presetBends=Object.keys(presets).map(name=>parseCurvatures(name));
const pointers=new Map();let gesture=null;
let homeFrame=null;

const factorWorker=new Worker(new URL('./factorWorker.js',import.meta.url),{type:'module'});
const factorCache=new Map(),factorQueue=[],factorQueued=new Set();
let factorLabels=false,factorActive=null;
const primeWorker=new Worker(new URL('./factorWorker.js',import.meta.url),{type:'module'});
const primeCache=new Map(),primeQueue=[],primeQueued=new Set();
let primeActive=null;

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
 const {value,terms,prime}=e.data;
 factorCache.set(value,terms);factorActive=null;
 if(typeof prime==='boolean')primeCache.set(value,prime);
 draw();pumpFactorQueue();
};

factorWorker.onerror=()=>{
 factorActive=null;resetFactorQueue();factorLabels=false;
 factorToggle.checked=false;factorToggle.disabled=true;
 draw();
};

factorToggle.onchange=()=>{
 factorLabels=factorToggle.checked;resetFactorQueue();
 if(factorLabels)update();
 else resetPrimeQueue();
 draw();
};

function pumpPrimeQueue(){
 if(primeActive!==null||primeQueue.length===0)return;
 primeActive=primeQueue.shift();primeQueued.delete(primeActive);
 primeWorker.postMessage({value:primeActive,mode:'prime'});
}
function requestPrime(value){
 const key=value.toString();
 if(primeCache.has(key)||primeActive===key||primeQueued.has(key))return;
 primeQueue.push(key);primeQueued.add(key);pumpPrimeQueue();
}
function resetPrimeQueue(){primeQueue.length=0;primeQueued.clear();}
function primeState(value){
 if(value<2n)return false;
 const key=value.toString();
 if(primeCache.has(key))return primeCache.get(key);
 requestPrime(value);return null;
}
primeWorker.onmessage=e=>{
 const {value,prime}=e.data;primeCache.set(value,prime);primeActive=null;
 draw();pumpPrimeQueue();
};
primeWorker.onerror=()=>{primeActive=null;resetPrimeQueue();};

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
  d.onclick=()=>{current=id;currentConfig=config;selectedResidues.clear();renderResidues();rebuild();renderCards();};
  panel.appendChild(d);drawThumbnail(t,config);
 }
 for(const name of Object.keys(presets))appendCard(name,presets[name],name);
 for(const entry of customConfigs)appendCard(entry.name,entry.config,entry.id);
}

function renderResidues(){
 const residues=admissibleResidues(currentConfig);
 allowedResidues=new Set(residues);residueColors=new Map(residues.map((residue,index)=>[residue,RESIDUE_PALETTE[index%RESIDUE_PALETTE.length]]));
 selectedResidues=new Set([...selectedResidues].filter(residue=>allowedResidues.has(residue)));
 residueButtons.replaceChildren();
 for(let mod3=0;mod3<3;mod3++)for(let mod8=0;mod8<8;mod8++){
  const residue=residueFromMod3Mod8(mod3,mod8);
  const button=document.createElement('button'),allowed=allowedResidues.has(residue);
  button.type='button';button.className='residue-button';button.textContent=String(residue);
  button.dataset.mod3=String(mod3);button.dataset.mod8=String(mod8);
  if(allowed)button.style.setProperty('--residue-color',residueColors.get(residue));
  button.disabled=!allowed;button.setAttribute('aria-pressed',String(selectedResidues.has(residue)));
  button.setAttribute('aria-label',allowed?`Show residue ${residue} modulo 24; ${mod3} modulo 3 and ${mod8} modulo 8`:`Residue ${residue} is not admissible modulo 24; ${mod3} modulo 3 and ${mod8} modulo 8`);
  button.addEventListener('click',()=>{if(selectedResidues.has(residue))selectedResidues.delete(residue);else selectedResidues.add(residue);renderResidues();draw();});
  residueButtons.appendChild(button);
 }
}

function update(){
 resetFactorQueue();
 while(viewStage.parent&&stageNeedsParent(viewStage,camera,canvas.width,canvas.height))viewStage=viewStage.parent;
 circles=visibleTreeProjected(viewStage.config,camera,canvas.width,canvas.height,MIN_CIRCLE_RADIUS_PX,
  viewStage.blockedIndex,viewStage.bridgeCircles,factorLabels);
 if(circles.nextStage)viewStage=traversalStage(circles.nextStage.config,circles.nextStage.blockedIndex,viewStage,
  circles.nextStage.bridgeCircles);
}
function fitOuter(){
 const outer=currentConfig.find(c=>c.b<0n)||currentConfig[0];
 const fit=fitOuterFor(currentConfig,canvas.width,canvas.height);
 camera=cameraForCircle(outer,canvas.width/2,canvas.height/2,scaleFromNumber(fit.zoom));
 homeScaleLog=scaleLog(camera.scale);
}
function cancelHomeAnimation(){if(homeFrame!==null){cancelAnimationFrame(homeFrame);homeFrame=null;}}
function rebuild(){cancelHomeAnimation();selectedCircle=null;inspector.hidden=true;viewStage=traversalStage(currentConfig);fitOuter();update();draw();}
function resize(){
 const oldWidth=canvas.width,oldHeight=canvas.height,rect=canvas.getBoundingClientRect();
 canvas.width=Math.max(1,Math.round(rect.width));canvas.height=Math.max(1,Math.round(rect.height));
 if(!camera){rebuild();return;}
 camera.screenX+=(canvas.width-oldWidth)/2;camera.screenY+=(canvas.height-oldHeight)/2;
 homeScaleLog=scaleLog(scaleFromNumber(fitOuterFor(currentConfig,canvas.width,canvas.height).zoom));
 update();draw();
}
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
 // Wrap long integers in either mode, including pending factorizations and
 // large prime factors. A multiplication dot starts each subsequent factor;
 // continuation rows have no dot, and powers stay with their final digits.
 if(terms.some(term=>term.length>14)){
  const columns=Math.ceil(Math.sqrt(terms.reduce((sum,term)=>sum+term.length,0)*1.8));
  const rows=terms.flatMap((term,index)=>{
   const [,digits,power='']=term.match(/^(-?\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]*)$/)||[null,term];
   const chunks=digits.match(new RegExp(`.{1,${columns}}`,'g'));
   chunks[chunks.length-1]+=power;
   if(index)chunks[0]='· '+chunks[0];
   return chunks;
  });
  const longest=Math.max(...rows.map(row=>row.length));
  const fontSize=Math.min(18,r*1.2/Math.max(longest*.62,rows.length*1.15));
  if(fontSize<7)return;
  ctx.font=fontSize+'px monospace';
  rows.forEach((row,i)=>ctx.fillText(row,x,y+(i-(rows.length-1)/2)*fontSize*1.15));
  return;
 }
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

function strokeProjectedBoundary(e){
 const boundary=projectedBoundary(e,camera,canvas.width,canvas.height);
 if(boundary.type==='none')return false;
 ctx.beginPath();
 if(boundary.type==='arc')ctx.arc(boundary.x,boundary.y,boundary.r,0,2*Math.PI);
 else{ctx.moveTo(boundary.x1,boundary.y1);ctx.lineTo(boundary.x2,boundary.y2);}
 ctx.stroke();return true;
}

function draw(){
 ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.textAlign='center';ctx.textBaseline='middle';
 const filtering=selectedResidues.size>0;
 const labelRects=[{left:0,right:canvas.width,top:0,bottom:canvas.height}];
 const drawOrder=!filtering?circles:[...circles].sort((a,b)=>Number(selectedResidues.has(residueMod(a.b)))-Number(selectedResidues.has(residueMod(b.b))));
 const items=drawOrder.map(e=>({e,c:projectCircle(e,camera)})),glowing=new Set();
 if(factorLabels)for(const {e,c} of items){
  if(e.b<2n||c.r<PRIME_GLOW_MIN_RADIUS_PX||primeState(e.b)!==true)continue;
  if(e.neighborBends?.some(bend=>primeState(bend)===true))glowing.add(e);
 }
 for(const {e,c} of items){
  const {r}=c;
  const residue=residueMod(c.b),highlighted=!filtering||selectedResidues.has(residue);
  const residueColor=residueColors.get(residue)||'#111';
  if(glowing.has(e)){
   ctx.save();ctx.strokeStyle=residueColor;ctx.lineWidth=4;ctx.globalAlpha=.9;
   ctx.shadowColor=residueColor;ctx.shadowBlur=Math.min(22,Math.max(9,r*.16));
   strokeProjectedBoundary(e,c);ctx.restore();
  }
  ctx.strokeStyle=highlighted?residueColor:'rgba(0,0,0,.14)';
  ctx.fillStyle=highlighted?residueColor:'rgba(0,0,0,.18)';
  ctx.lineWidth=filtering&&highlighted?2.5:1;
  strokeProjectedBoundary(e,c);
  const label=projectedLabelPlacement(e,camera,canvas.width,canvas.height,labelRects);
  if(label)drawFittedLabel(labelTerms(c.b),label.x,label.y,label.r);
 }
 ctx.lineWidth=1;
 if(selectedCircle){ctx.save();ctx.strokeStyle='#111';ctx.lineWidth=3;strokeProjectedBoundary(selectedCircle);ctx.restore();}
 const digits=Math.max(0,...circles.filter(c=>c.b>0n).map(c=>c.b.toString().length));
 const orders=Math.max(0,Math.floor((scaleLog(camera.scale)-homeScaleLog)/Math.LN10));
 zoomStatus.textContent=`${orders} zoom orders · ${digits}-digit curvatures`;
}

function zoomAt(oldX,oldY,newX,newY,factor){
 return zoomCameraAt(camera,oldX,oldY,newX,newY,factor);
}

function animateHome(){
 cancelHomeAnimation();
 const outer=currentConfig.find(c=>c.b<0n)||currentConfig[0];
 const target=fitOuterFor(currentConfig,canvas.width,canvas.height),targetScale=scaleFromNumber(target.zoom);
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){
  camera=cameraForCircle(outer,canvas.width/2,canvas.height/2,targetScale);update();draw();return;
 }
 const started=performance.now(),logStart=scaleLog(camera.scale),logEnd=scaleLog(targetScale);
 const zoomDistance=Math.abs(logEnd-logStart);
 // Match a steady, ordinary mouse-wheel pace (about six 100-unit notches per
 // second) using the same sensitivity as manual zooming.
 const zoomDuration=zoomDistance<1e-9?0:Math.max(HOME_MIN_DURATION_MS,
  zoomDistance/(WHEEL_ZOOM_SENSITIVITY*HOME_WHEEL_DELTA_PER_SECOND)*1000);
 const panDuration=HOME_RECENTER_DURATION_MS;
 const duration=zoomDuration+panDuration;
 let panStart=null;
 function step(now){
  const elapsed=now-started;
  if(elapsed<zoomDuration){
   const t=elapsed/zoomDuration;
   const desired=logStart+(logEnd-logStart)*t,currentLog=scaleLog(camera.scale),factor=Math.exp(desired-currentLog);
   zoomAt(canvas.width/2,canvas.height/2,canvas.width/2,canvas.height/2,factor);
  }else{
   if(!panStart){
    const factor=Math.exp(logEnd-scaleLog(camera.scale));
    zoomAt(canvas.width/2,canvas.height/2,canvas.width/2,canvas.height/2,factor);
    const outerScreen=projectCircle(outer,camera);
    panStart={anchorX:camera.screenX,anchorY:camera.screenY,outerX:outerScreen.x,outerY:outerScreen.y};
   }
   const t=panDuration?Math.min(1,(elapsed-zoomDuration)/panDuration):1;
   const eased=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
   camera.screenX=panStart.anchorX+(canvas.width/2-panStart.outerX)*eased;
   camera.screenY=panStart.anchorY+(canvas.height/2-panStart.outerY)*eased;
  }
  update();draw();
  if(elapsed<duration)homeFrame=requestAnimationFrame(step);
  else{camera=cameraForCircle(outer,canvas.width/2,canvas.height/2,targetScale);viewStage=traversalStage(currentConfig);homeFrame=null;update();draw();}
 }
 homeFrame=requestAnimationFrame(step);
}

homeButton.addEventListener('click',animateHome);

function inspectCircle(c){
 selectedCircle=c;inspector.hidden=false;
 const values=exactCircleValues(c);
 function texFraction(value){return value.d===1n?value.n.toString():`\\frac{${value.n}}{${value.d}}`;}
 const fields=[['Curvature',values.curvature.toString()],['Center, horizontal',texFraction(values.x)],
  ['Center, vertical',texFraction(values.y)],['Radius',texFraction(values.radius)]];
 exactValue.replaceChildren();
 for(const [label,tex] of fields){
  const row=document.createElement('div'),title=document.createElement('div'),math=document.createElement('div');
  title.className='value-title';title.textContent=label;math.className='exact-math';
  katex.render(tex,math,{throwOnError:false,output:'htmlAndMathml'});
  row.append(title,math);exactValue.append(row);
 }
 document.getElementById('inspector-title').textContent=`Exact circle · ${(c.b<0n?-c.b:c.b).toString().length} digits`;
 draw();
}
function circleAt(x,y){
 let selected=null,smallest=Infinity;
 for(const c of circles){
  const p=projectCircle(c,camera);
  if(c.b>0n&&Number.isFinite(p.r)&&p.r<smallest&&Math.hypot(p.x-x,p.y-y)<=p.r){selected=c;smallest=p.r;}
 }
 if(selected)return selected;
 let distance=8;
 for(const c of circles){
  const boundary=projectedBoundary(c,camera,canvas.width,canvas.height);
  if(boundary.type!=='line')continue;
  const dx=boundary.x2-boundary.x1,dy=boundary.y2-boundary.y1;
  const d=Math.abs(dx*(boundary.y1-y)-(boundary.x1-x)*dy)/Math.hypot(dx,dy);
  if(d<distance){selected=c;distance=d;}
 }
 return selected;
}
document.getElementById('inspector-close').onclick=()=>{selectedCircle=null;inspector.hidden=true;draw();};
document.getElementById('copy-value').onclick=async()=>{
 if(!selectedCircle)return;
 const values=exactCircleValues(selectedCircle),f=v=>v.d===1n?String(v.n):`${v.n}/${v.d}`;
 const text=`Curvature: ${values.curvature}\nCenter: (${f(values.x)}, ${f(values.y)})\nRadius: ${f(values.radius)}`;
 const button=document.getElementById('copy-value');
 try{await navigator.clipboard.writeText(text);button.textContent='Copied';}
 catch{button.textContent='Select and copy values above';}
 setTimeout(()=>button.textContent='Copy exact values',1800);
};
document.getElementById('dive-button').onclick=()=>{
 cancelHomeAnimation();
 const candidates=circles.filter(c=>c.b>0n&&c.configuration);
 const chosen=candidates.reduce((best,c)=>{
  const p=projectCircle(c,camera),distance=Math.hypot(p.x-canvas.width/2,p.y-canvas.height/2);
  return !best||distance<best.distance?{c,distance}:best;
 },null);
 if(!chosen)return;
 const {target}=descendConfiguration(chosen.c.configuration);
 camera=cameraForCircle(target,canvas.width/2,canvas.height/2,scaleFromBigInt(target.b,Math.min(150,Math.min(canvas.width,canvas.height)*.24)));
 update();inspectCircle(target);
};
for(const [id,factor] of [['zoom-in',2],['zoom-out',.5]])document.getElementById(id).onclick=()=>{
 cancelHomeAnimation();zoomAt(canvas.width/2,canvas.height/2,canvas.width/2,canvas.height/2,factor);update();draw();
};
canvas.addEventListener('dblclick',e=>{
 const rect=canvas.getBoundingClientRect(),c=circleAt(e.clientX-rect.left,e.clientY-rect.top);
 if(!c||c.b<=0n)return;
 cancelHomeAnimation();camera=cameraForCircle(c,canvas.width/2,canvas.height/2,
  scaleFromBigInt(c.b,Math.min(canvas.width,canvas.height)*.3));update();inspectCircle(c);
});

function setCustomForm(open){
 customButton.setAttribute('aria-expanded',String(open));customForm.hidden=!open;
 if(open){customError.textContent='';customInput.focus();}
}
customButton.addEventListener('click',()=>setCustomForm(customForm.hidden));
customCancel.addEventListener('click',()=>setCustomForm(false));
function selectAddedConfiguration(bends){
 const name=`(${bends.join(',')})`,id=`custom:${name}`;
 let entry=customConfigs.find(candidate=>candidate.id===id);
 if(!entry){entry={id,name,config:configurationFromCurvatures(bends)};customConfigs.push(entry);}
 currentConfig=entry.config;current=entry.id;
 selectedResidues.clear();setCustomForm(false);renderResidues();rebuild();renderCards();
}
randomButton.addEventListener('click',()=>selectAddedConfiguration(randomRootCurvatures([...presetBends,...customConfigs.map(entry=>parseCurvatures(entry.name))])));
customForm.addEventListener('submit',e=>{
 e.preventDefault();
 try{
  const bends=completeCurvatures(parseCurvatures(customInput.value));
  selectAddedConfiguration(bends);
 }catch(error){customError.textContent=error.message;}
});

canvas.addEventListener('wheel',e=>{
 e.preventDefault();cancelHomeAnimation();const rect=canvas.getBoundingClientRect();
 const mx=e.clientX-rect.left,my=e.clientY-rect.top;
 const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.height:1);
 if(zoomAt(mx,my,mx,my,Math.exp(-Math.max(-1000,Math.min(1000,delta))*WHEEL_ZOOM_SENSITIVITY))){update();draw();}
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
 if(pointers.size===1)pointerStart={x:e.clientX,y:e.clientY,moved:false};
 else if(pointerStart)pointerStart.moved=true;
 canvas.classList.add('interacting');
});

canvas.addEventListener('pointermove',e=>{
 if(!pointers.has(e.pointerId))return;
 if(pointerStart&&Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>5)pointerStart.moved=true;
 e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 const next=currentGesture();let changed=false;
 if(gesture?.type==='pan'&&next?.type==='pan'){
  const rect=canvas.getBoundingClientRect();
  changed=zoomAt(gesture.x-rect.left,gesture.y-rect.top,next.x-rect.left,next.y-rect.top,1);
 }else if(gesture?.type==='pinch'&&next?.type==='pinch'){
  const rect=canvas.getBoundingClientRect();
  changed=zoomAt(gesture.x-rect.left,gesture.y-rect.top,next.x-rect.left,next.y-rect.top,next.distance/gesture.distance);
 }
 gesture=next;if(changed){update();draw();}
});

function endPointer(e){
 const inspect=e.type==='pointerup'&&pointers.size===1&&pointerStart&&!pointerStart.moved;
 if(!pointers.delete(e.pointerId))return;
 if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
 gesture=currentGesture();if(pointers.size===0)canvas.classList.remove('interacting');
 if(inspect){const rect=canvas.getBoundingClientRect(),c=circleAt(e.clientX-rect.left,e.clientY-rect.top);if(c)inspectCircle(c);}
 if(pointers.size===0)pointerStart=null;
}
canvas.addEventListener('pointerup',endPointer);
canvas.addEventListener('pointercancel',endPointer);
canvas.addEventListener('lostpointercapture',endPointer);

renderResidues();resize();renderCards();
