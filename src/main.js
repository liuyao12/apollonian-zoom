import {toFloat,generate} from './apollonianBigInt.js';
import {descendConfiguration,exactCircleValues} from './deepNavigation.js';
import {presets} from './presets.js';
import {completeCurvatures,configurationFromCurvatures,parseCurvatures} from './customConfig.js';
import {cameraForCircle,projectedBoundary,projectedDiskRegion,projectCircle,scaleFromBigInt,scaleFromNumber,scaleLog,stageNeedsParent,traversalStage,visibleTreeProjected,zoomCameraAt,zoomPathToCircle} from './exactViewport.js?v=scaling-labels';
import {clipHalfPlane,placeVisibleLabel} from './labelPlacement.js?v=scaling-labels';
import {circleBoundaryPrimitive} from './circleRenderer.js';
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
const inspectorFactors=document.getElementById('inspector-factors');
const zoomStatus=document.getElementById('zoom-status');
let selectedCircle=null,homeScaleLog=0,pointerStart=null;
const MIN_CIRCLE_RADIUS_PX=2;
const PRIME_GLOW_MIN_RADIUS_PX=5;
const RESIDUE_PALETTE=['#1565c0','#c44e00','#14805e','#b13b72','#6f42c1','#8c564b','#00838f','#c62828'];
const FACTOR_INKS_LIGHT=['#fff2ad','#c8fff2','#ffded0','#e0edff','#f7dbff','#ffe8c1','#dcffcb'];
const FACTOR_INKS_DARK=['#674600','#006557','#8d3224','#194c87','#712d80','#7d4521','#356118'];
const WHEEL_ZOOM_SENSITIVITY=.001;
const HOME_WHEEL_DELTA_PER_SECOND=600,HOME_MIN_DURATION_MS=400;
const HOME_RECENTER_DURATION_MS=650;
const DIVE_DURATION_MS=2200;
let current=Object.keys(presets)[0],currentConfig=presets[current],viewStage=traversalStage(currentConfig),circles=[],camera=null;
let projectedCircles=[],packingInterior,workerDrawFrame=null;
let allowedResidues=new Set(),residueColors=new Map(),selectedResidues=new Set();
const customConfigs=[];
const presetBends=Object.keys(presets).map(name=>parseCurvatures(name));
const pointers=new Map();let gesture=null;
let navigationFrame=null;

const factorWorkerURL=new URL('./factorWorker.js?v=live-factors',import.meta.url);
const factorWorker=new Worker(factorWorkerURL,{type:'module'});
const factorCache=new Map();
let factorLabels=false,factorTargets=new Set();
const primeWorker=new Worker(factorWorkerURL,{type:'module'});
const primeCache=new Map(),primeQueue=[],primeQueued=new Set();
let primeActive=null;

function syncFactorTargets(wanted){
 if(wanted.size===factorTargets.size&&[...wanted].every(key=>factorTargets.has(key)))return;
 for(const key of factorTargets){
  if(!wanted.has(key)&&factorCache.get(key)?.complete===false)factorCache.delete(key);
 }
 factorTargets=wanted;
 factorWorker.postMessage({values:[...wanted]});
}

function requestWorkerDraw(){
 if(!factorLabels||workerDrawFrame!==null)return;
 workerDrawFrame=requestAnimationFrame(()=>{workerDrawFrame=null;draw();});
}

factorWorker.onmessage=e=>{
 const {value,terms,prime,complete}=e.data;
 if(!complete&&(!factorTargets.has(value)||factorCache.get(value)?.complete))return;
 factorCache.set(value,{terms,complete});
 if(typeof prime==='boolean')primeCache.set(value,prime);
 requestWorkerDraw();
};

factorWorker.onerror=()=>{
 factorLabels=false;
 factorToggle.checked=false;factorToggle.disabled=true;
 draw();
};

factorToggle.onchange=()=>{
 factorLabels=factorToggle.checked;
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
 requestWorkerDraw();pumpPrimeQueue();
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
 while(viewStage.parent&&stageNeedsParent(viewStage,camera,canvas.width,canvas.height))viewStage=viewStage.parent;
 // The root still bounds the background when a deep view omits its boundary.
 const outer=currentConfig.find(circle=>circle.b<0n);
 packingInterior=projectedDiskRegion(outer,camera,canvas.width,canvas.height,false);
 circles=visibleTreeProjected(viewStage.config,camera,canvas.width,canvas.height,MIN_CIRCLE_RADIUS_PX,
  viewStage.blockedIndex,viewStage.bridgeCircles,factorLabels);
 // Filters and factor results repaint the same viewport geometry.
 projectedCircles=circles.map(circle=>{
  const region=projectedDiskRegion(circle,camera,canvas.width,canvas.height);
  const boundary=region.type==='disk'
   ?circleBoundaryPrimitive(region.x,region.y,region.r,canvas.width,canvas.height)
   :projectedBoundary(circle,camera,canvas.width,canvas.height);
  return {circle,region,boundary,residue:residueMod(circle.b)};
 });
 if(circles.nextStage)viewStage=traversalStage(circles.nextStage.config,circles.nextStage.blockedIndex,viewStage,
  circles.nextStage.bridgeCircles);
}
function fitOuter(){
 const outer=currentConfig.find(c=>c.b<0n)||currentConfig[0];
 const fit=fitOuterFor(currentConfig,canvas.width,canvas.height);
 camera=cameraForCircle(outer,canvas.width/2,canvas.height/2,scaleFromNumber(fit.zoom));
 homeScaleLog=scaleLog(camera.scale);
}
function cancelNavigationAnimation(){
 if(navigationFrame!==null)cancelAnimationFrame(navigationFrame);
 navigationFrame=null;
}
function rebuild(){cancelNavigationAnimation();selectedCircle=null;inspector.hidden=true;viewStage=traversalStage(currentConfig);fitOuter();update();draw();}
function resize(){
 const oldWidth=canvas.width,oldHeight=canvas.height,rect=canvas.getBoundingClientRect();
 canvas.width=Math.max(1,Math.round(rect.width));canvas.height=Math.max(1,Math.round(rect.height));
 if(!camera){rebuild();return;}
 if(canvas.width!==oldWidth||canvas.height!==oldHeight)cancelNavigationAnimation();
 camera.screenX+=(canvas.width-oldWidth)/2;camera.screenY+=(canvas.height-oldHeight)/2;
 homeScaleLog=scaleLog(scaleFromNumber(fitOuterFor(currentConfig,canvas.width,canvas.height).zoom));
 update();draw();
}
addEventListener('resize',resize);

function factorInk(term,palette,defaultInk){
 if(term==='-1'||term==='1'||term==='0')return defaultInk;
 let index=0;
 for(const digit of term){
  if(digit<'0'||digit>'9')break; // A power uses its prime base's color.
  index=(index*10+Number(digit))%palette.length;
 }
 return palette[index];
}

function factorInks(terms,complete,lightBackground,normalInk){
 const palette=lightBackground?FACTOR_INKS_DARK:FACTOR_INKS_LIGHT;
 return terms.map((term,i)=>{
  if(!complete&&i===terms.length-1)return lightBackground?'#636363':'#d4d4d4';
  return factorInk(term,palette,normalInk);
 });
}

function updateInspectorFactors(wanted){
 inspectorFactors.hidden=!factorLabels||!selectedCircle||inspector.hidden;
 if(inspectorFactors.hidden)return;
 const key=selectedCircle.b.toString(),factors=factorCache.get(key),terms=factors?.terms??[key];
 if(!factors?.complete)wanted.add(key);
 const inks=factorInks(terms,factors?.complete,true,'#222');
 const tex=terms.map((term,i)=>{
  const value=term.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+$/,power=>
   '^{'+[...power].map(d=>'⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(d)).join('')+'}');
  return `\\textcolor{${inks[i]}}{${value}}`;
 }).join(' \\cdot ');
 const math=inspectorFactors.lastElementChild;
 if(math.dataset.tex!==tex){
  katex.render(tex,math,{throwOnError:false,output:'htmlAndMathml'});math.dataset.tex=tex;
 }
 inspectorFactors.firstElementChild.textContent=factors?.complete?'Prime factors':'Prime factors (factoring…)';
}

function rowWidth(terms,fontSize,leadingDot){
 ctx.font=fontSize+'px sans-serif';
 let width=terms.reduce((sum,term)=>sum+ctx.measureText(term).width,0);
 const dotCount=terms.length-1+Number(leadingDot);
 if(dotCount){
  const gap=fontSize*.09,dotSize=fontSize*.5;
  ctx.font=dotSize+'px sans-serif';
  width+=dotCount*(ctx.measureText('·').width+2*gap);
 }
 return width;
}

function layoutAtSize(terms,fontSize,r){
 const innerRadius=r*.8,lineHeight=fontSize*1.08,n=terms.length;
 const widths=Array.from({length:n},()=>Array(n+1).fill(0));
 for(let start=0;start<n;start++)for(let end=start+1;end<=n;end++)widths[start][end]=rowWidth(terms.slice(start,end),fontSize,start>0);

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

function drawFittedLabel(terms,x,y,r,preferredFontSize=r*.48,inks){
 // Wrap long integers in either mode, including pending factorizations and
 // large prime factors. A multiplication dot starts each subsequent factor;
 // continuation rows have no dot, and powers stay with their final digits.
 if(terms.length>12||terms.some(term=>term.length>14)){
  const columns=Math.ceil(Math.sqrt(terms.reduce((sum,term)=>sum+term.length,0)*1.8));
  const rows=[];
  let row;
  terms.forEach((term,index)=>{
   const [,digits,power='']=term.match(/^(-?\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]*)$/)||[null,term];
   const chunks=digits.match(new RegExp(`.{1,${columns}}`,'g'));
   chunks[chunks.length-1]+=power;
   if(index)chunks[0]='· '+chunks[0];
   for(const chunk of chunks){
    if(!row||row.length+1+chunk.length>columns){
     row={runs:[],length:0};rows.push(row);
    }
    const text=(row.length?' ':'')+chunk;
    row.runs.push({text,ink:inks?.[index]});row.length+=text.length;
   }
  });
  const longest=Math.max(...rows.map(row=>row.length));
  const fontSize=Math.min(preferredFontSize,r*1.2/Math.max(longest*.62,rows.length*1.15));
  if(fontSize<7)return;
  ctx.font=fontSize+'px monospace';
  rows.forEach((row,i)=>{
   const widths=row.runs.map(run=>ctx.measureText(run.text).width);
   let cursor=x-widths.reduce((sum,w)=>sum+w,0)/2;
   const rowY=y+(i-(rows.length-1)/2)*fontSize*1.15;
   row.runs.forEach((run,j)=>{
    if(run.ink)ctx.fillStyle=run.ink;
    ctx.fillText(run.text,cursor+widths[j]/2,rowY);cursor+=widths[j];
   });
  });
  return;
 }
 let low=0,high=Math.min(preferredFontSize,r*1.6),layout=null;
 if(terms.length===1){
  ctx.font=high+'px sans-serif';
  if(Math.hypot(ctx.measureText(terms[0]).width,high)<=r*1.6){
   if(inks)ctx.fillStyle=inks[0];
   ctx.fillText(terms[0],x,y);return;
  }
 }
 for(let i=0;i<12;i++){
  const size=(low+high)/2,candidate=layoutAtSize(terms,size,r);
  if(candidate){layout=candidate;low=size;}else high=size;
 }
 if(!layout)return;
 let index=0;
 layout.rows.forEach((row,rowIndex)=>{
  const rowY=y+(rowIndex-(layout.rows.length-1)/2)*layout.lineHeight;
  let cursor=x-row.width/2;
  row.terms.forEach(term=>{
   if(inks)ctx.fillStyle=inks[index];
   if(index>0){
    const gap=layout.fontSize*.09,dotSize=layout.fontSize*.5;
    cursor+=gap;ctx.font=dotSize+'px sans-serif';
    const dotWidth=ctx.measureText('·').width;
    ctx.fillText('·',cursor+dotWidth/2,rowY+layout.fontSize*.04);cursor+=dotWidth+gap;
   }
   ctx.font=layout.fontSize+'px sans-serif';
   const termWidth=ctx.measureText(term).width;
   ctx.fillText(term,cursor+termWidth/2,rowY);cursor+=termWidth;
   index++;
  });
 });
}

function strokeProjectedBoundary(boundary){
 if(boundary.type==='none')return;
 ctx.beginPath();
 if(boundary.type==='arc')ctx.arc(boundary.x,boundary.y,boundary.r,0,2*Math.PI);
 else{ctx.moveTo(boundary.x1,boundary.y1);ctx.lineTo(boundary.x2,boundary.y2);}
 ctx.stroke();
}

function fillDiskRegion(region,viewport){
 if(region.outside)return;
 ctx.beginPath();
 if(region.type==='disk'){
  ctx.arc(region.x,region.y,region.r,0,2*Math.PI);
  ctx.fill();
 }else if(region.type==='halfPlane'){
  const polygon=clipHalfPlane(region,viewport);
  if(!polygon.length)return;
  ctx.moveTo(polygon[0].x,polygon[0].y);
  for(let i=1;i<polygon.length;i++)ctx.lineTo(polygon[i].x,polygon[i].y);
  ctx.closePath();ctx.fill();
 }else if(region.type==='rectangle'){
  ctx.fillRect(0,0,canvas.width,canvas.height);
 }
}

function draw(){
 ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.textAlign='center';ctx.textBaseline='middle';
 const filtering=selectedResidues.size>0;
 const labelRects=[{left:0,right:canvas.width,top:0,bottom:canvas.height}];
 ctx.fillStyle='#d9d9d9';fillDiskRegion(packingInterior,labelRects[0]);
 for(const {region,residue} of projectedCircles){
  const highlighted=!filtering||selectedResidues.has(residue);
  ctx.fillStyle=highlighted?residueColors.get(residue):'#ededed';
  fillDiskRegion(region,labelRects[0]);
 }
 if(factorLabels)for(const {circle,region,boundary,residue} of projectedCircles){
  const r=region.r??Infinity;
  if(circle.b>=2n&&r>=PRIME_GLOW_MIN_RADIUS_PX&&primeState(circle.b)===true&&
   circle.neighborBends?.some(bend=>primeState(bend)===true)){
   const residueColor=residueColors.get(residue);
   ctx.save();ctx.strokeStyle=residueColor;ctx.lineWidth=4;ctx.globalAlpha=.9;
   ctx.shadowColor=residueColor;ctx.shadowBlur=Math.min(22,Math.max(9,r*.16));
   strokeProjectedBoundary(boundary);ctx.restore();
  }
 }
 ctx.strokeStyle='#000';ctx.lineWidth=2;
 for(const {boundary} of projectedCircles)strokeProjectedBoundary(boundary);
 const wantedFactors=new Set();
 for(const {circle,region,residue} of projectedCircles){
  let labelRegion=region,preferredFontSize;
  const key=circle.b.toString(),factors=factorLabels?factorCache.get(key):null;
  const terms=factors?.terms??[key];
  if(region.outside){
   // Reserve space next to the enclosing circle for the actual text width.
   preferredFontSize=.48*Math.min(region.r??Infinity,Math.hypot(canvas.width,canvas.height));
   ctx.font=preferredFontSize+'px sans-serif';
   const width=ctx.measureText(terms.join(' · ')).width;
   labelRegion={...region,labelRadius:Math.hypot(width,preferredFontSize)/1.6};
  }
  const label=placeVisibleLabel(labelRegion,labelRects);
  if(!label)continue;
  const highlighted=!filtering||selectedResidues.has(residue);
  const labelColor=region.outside?residueColors.get(residue):'#fff';
  const normalInk=highlighted?labelColor:'#626262';
  ctx.fillStyle=normalInk;
  let inks;
  if(factorLabels){
   if(!factors?.complete)wantedFactors.add(key);
   inks=factorInks(terms,factors?.complete,region.outside||!highlighted,normalInk);
  }
  drawFittedLabel(terms,label.x,label.y,label.r,preferredFontSize,inks);
 }
 updateInspectorFactors(wantedFactors);syncFactorTargets(wantedFactors);
 if(selectedCircle){
  ctx.save();ctx.lineWidth=3;
  strokeProjectedBoundary(projectedBoundary(selectedCircle,camera,canvas.width,canvas.height));ctx.restore();
 }
 const digits=Math.max(0,...circles.filter(c=>c.b>0n).map(c=>c.b.toString().length));
 const orders=Math.max(0,Math.floor((scaleLog(camera.scale)-homeScaleLog)/Math.LN10));
 zoomStatus.textContent=`${orders} zoom orders · ${digits}-digit curvatures`;
}

function zoomAt(oldX,oldY,newX,newY,factor){
 return zoomCameraAt(camera,oldX,oldY,newX,newY,factor);
}

function animateHome(){
 cancelNavigationAnimation();
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
  if(elapsed<duration)navigationFrame=requestAnimationFrame(step);
  else{camera=cameraForCircle(outer,canvas.width/2,canvas.height/2,targetScale);viewStage=traversalStage(currentConfig);navigationFrame=null;update();draw();}
 }
 navigationFrame=requestAnimationFrame(step);
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
 cancelNavigationAnimation();
 const candidates=circles.filter(c=>c.b>0n&&c.configuration);
 const chosen=candidates.reduce((best,c)=>{
  const p=projectCircle(c,camera),distance=Math.hypot(p.x-canvas.width/2,p.y-canvas.height/2);
  return !best||distance<best.distance?{c,distance}:best;
 },null);
 if(!chosen)return;
 const {target}=descendConfiguration(chosen.c.configuration);
 const targetScale=scaleFromBigInt(target.b,Math.min(150,Math.min(canvas.width,canvas.height)*.24));
 const cameraAt=zoomPathToCircle(camera,target,canvas.width,canvas.height,targetScale);
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const started=performance.now();
 selectedCircle=null;inspector.hidden=true;
 function step(now){
  const t=reducedMotion?1:Math.min(1,Math.max(0,(now-started)/DIVE_DURATION_MS));
  camera=cameraAt(t*t*(3-2*t));update();
  if(t===1){navigationFrame=null;inspectCircle(target);return;}
  draw();navigationFrame=requestAnimationFrame(step);
 }
 step(started);
};
for(const [id,factor] of [['zoom-in',2],['zoom-out',.5]])document.getElementById(id).onclick=()=>{
 cancelNavigationAnimation();zoomAt(canvas.width/2,canvas.height/2,canvas.width/2,canvas.height/2,factor);update();draw();
};
canvas.addEventListener('dblclick',e=>{
 const rect=canvas.getBoundingClientRect(),c=circleAt(e.clientX-rect.left,e.clientY-rect.top);
 if(!c||c.b<=0n)return;
 cancelNavigationAnimation();camera=cameraForCircle(c,canvas.width/2,canvas.height/2,
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
 e.preventDefault();cancelNavigationAnimation();const rect=canvas.getBoundingClientRect();
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
 e.preventDefault();cancelNavigationAnimation();canvas.setPointerCapture(e.pointerId);
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
