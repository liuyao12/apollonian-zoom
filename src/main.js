import {toFloat,createTree,generate,visibleTree} from './apollonianBigInt.js';
import {presets} from './presets.js';

const canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d');
const panel=document.getElementById('presets');
let current=Object.keys(presets)[0],zoom=600,offsetX=0,offsetY=0,circles=[],dragging=false,last=[0,0];
let root=createTree(presets[current]);

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
function update(){circles=visibleTree(root,viewport(),zoom);}
function fitOuter(){const c=fitOuterFor(presets[current],canvas.width,canvas.height);zoom=c.zoom;offsetX=c.offsetX;offsetY=c.offsetY;}
function rebuild(){fitOuter();update();draw();}
function resize(){canvas.width=innerWidth-150;canvas.height=innerHeight;rebuild();}
addEventListener('resize',resize);

function draw(){
 ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.strokeStyle='black';ctx.fillStyle='black';ctx.textAlign='center';ctx.textBaseline='middle';
 for(const e of circles){const c=toFloat(e),x=offsetX+c.x*zoom,y=offsetY-c.y*zoom,r=c.r*zoom;if(!Number.isFinite(x+y+r))continue;if(x+r<0||x-r>canvas.width||y+r<0||y-r>canvas.height)continue;ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.stroke();if(c.b<0n){ctx.font=Math.max(18,r*.25)+'px sans-serif';const d=r+Math.max(30,r*.2);ctx.fillText(c.b.toString(),x+d/Math.SQRT2,y-d/Math.SQRT2);}else if(r>10){ctx.font=Math.max(9,Math.min(r*.4,40))+'px sans-serif';ctx.fillText(c.b.toString(),x,y);}}
}

canvas.addEventListener('wheel',e=>{e.preventDefault();const rect=canvas.getBoundingClientRect();const mx=e.clientX-rect.left,my=e.clientY-rect.top;const f=Math.exp(-e.deltaY*.001);const wx=(mx-offsetX)/zoom,wy=-(my-offsetY)/zoom;zoom*=f;offsetX=mx-wx*zoom;offsetY=my+wy*zoom;update();draw();},{passive:false});
canvas.onmousedown=e=>{dragging=true;last=[e.clientX,e.clientY]};
canvas.onmouseup=()=>dragging=false;
canvas.onmousemove=e=>{if(!dragging)return;offsetX+=e.clientX-last[0];offsetY+=e.clientY-last[1];last=[e.clientX,e.clientY];update();draw();};

resize();renderCards();
