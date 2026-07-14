import {toFloat,createTree,generate,visibleTree} from './apollonianBigInt.js';
import {circleBoundaryPrimitive} from './circleRenderer.js';
import {presets} from './presets.js';

const canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d');
const panel=document.getElementById('presets');
const factorToggle=document.getElementById('factor-toggle');
const MIN_CIRCLE_RADIUS_PX=2;
let current=Object.keys(presets)[0],zoom=600,offsetX=0,offsetY=0,circles=[],dragging=false,last=[0,0];
let root=createTree(presets[current]);

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
 for(const name of Object.keys(presets)){
  const d=document.createElement('div');d.className='card'+(name===current?' selected':'');
  const t=document.createElement('canvas');t.width=130;t.height=100;t.className='thumb';
  const label=document.createElement('div');label.className='label';label.textContent=name;
  d.appendChild(t);d.appendChild(label);
  d.onclick=()=>{current=name;root=createTree(presets[current]);rebuild();renderCards();};
  panel.appendChild(d);drawThumbnail(t,presets[name]);
 }
}

function viewport(){return {left:(0-offsetX)/zoom,right:(canvas.width-offsetX)/zoom,top:offsetY/zoom,bottom:(offsetY-canvas.height)/zoom};}
function update(){resetFactorQueue();circles=visibleTree(root,viewport(),zoom,MIN_CIRCLE_RADIUS_PX);}
function fitOuter(){const c=fitOuterFor(presets[current],canvas.width,canvas.height);zoom=c.zoom;offsetX=c.offsetX;offsetY=c.offsetY;}
function rebuild(){fitOuter();update();draw();}
function resize(){canvas.width=innerWidth-150;canvas.height=innerHeight;rebuild();}
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

canvas.addEventListener('wheel',e=>{e.preventDefault();const rect=canvas.getBoundingClientRect();const mx=e.clientX-rect.left,my=e.clientY-rect.top;const f=Math.exp(-e.deltaY*.001);const wx=(mx-offsetX)/zoom,wy=-(my-offsetY)/zoom;zoom*=f;offsetX=mx-wx*zoom;offsetY=my+wy*zoom;update();draw();},{passive:false});
canvas.onmousedown=e=>{dragging=true;last=[e.clientX,e.clientY]};
canvas.onmouseup=()=>dragging=false;
canvas.onmousemove=e=>{if(!dragging)return;offsetX+=e.clientX-last[0];offsetY+=e.clientY-last[1];last=[e.clientX,e.clientY];update();draw();};

resize();renderCards();
