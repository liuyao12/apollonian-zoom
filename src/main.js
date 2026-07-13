import {generateVisible,toFloat} from './apollonianBigInt.js';
import {presets} from './presets.js';

const canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d');
const panel=document.getElementById('presets');
let current=Object.keys(presets)[0],zoom=600,offsetX=0,offsetY=0,circles=[],dragging=false,last=[0,0];

for(const name of Object.keys(presets)){
 const d=document.createElement('div');d.className='card';d.textContent=name;
 d.onclick=()=>{current=name;rebuild();};panel.appendChild(d);
}

function viewport(){return {left:(0-offsetX)/zoom,right:(canvas.width-offsetX)/zoom,top:offsetY/zoom,bottom:(offsetY-canvas.height)/zoom};}
function update(){circles=generateVisible(presets[current],viewport(),zoom);}

function fitOuter(){
 const outer=presets[current].find(c=>c.b<0n);
 if(!outer)return;
 const c=toFloat(outer);
 zoom=0.42*Math.min(canvas.width,canvas.height)/c.r;
 offsetX=canvas.width/2-c.x*zoom;
 offsetY=canvas.height/2+c.y*zoom;
}

function rebuild(){fitOuter();update();draw();}
function resize(){canvas.width=innerWidth-150;canvas.height=innerHeight;rebuild();}
addEventListener('resize',resize);

function draw(){
 ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.strokeStyle='black';ctx.fillStyle='black';ctx.textAlign='center';ctx.textBaseline='middle';
 for(const e of circles){
  const c=toFloat(e);const x=offsetX+c.x*zoom,y=offsetY-c.y*zoom,r=c.r*zoom;
  if(!Number.isFinite(x+y+r))continue;
  if(x+r<0||x-r>canvas.width||y+r<0||y-r>canvas.height)continue;
  ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.stroke();
  if(c.b<0n){
   ctx.font=Math.max(18,r*.25)+'px sans-serif';
   const d=r+Math.max(30,r*.2);
   ctx.fillText(c.b.toString(),x+d/Math.SQRT2,y-d/Math.SQRT2);
  }else if(r>10){ctx.font=Math.max(9,Math.min(r*.4,40))+'px sans-serif';ctx.fillText(c.b.toString(),x,y);}
 }
}

canvas.addEventListener('wheel',e=>{e.preventDefault();const f=Math.exp(-e.deltaY*.001);const wx=(e.clientX-offsetX)/zoom,wy=-(e.clientY-offsetY)/zoom;zoom*=f;offsetX=e.clientX-wx*zoom;offsetY=e.clientY+wy*zoom;update();draw();},{passive:false});
canvas.onmousedown=e=>{dragging=true;last=[e.clientX,e.clientY]};
canvas.onmouseup=()=>dragging=false;
canvas.onmousemove=e=>{if(!dragging)return;offsetX+=e.clientX-last[0];offsetY+=e.clientY-last[1];last=[e.clientX,e.clientY];update();draw()};
resize();rebuild();