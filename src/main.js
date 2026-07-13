import { generate } from './apollonianBigInt.js';
import { presets } from './presets.js';

const canvas=document.getElementById('canvas');
const ctx=canvas.getContext('2d');
let zoom=600;
let offsetX=0, offsetY=0;
let dragging=false,last=[0,0];
let circles=[];

function rebuild(){
  circles=generate(presets.Classic,8);
  offsetX=canvas.width/2;
  offsetY=canvas.height/2;
  draw();
}

function resize(){canvas.width=innerWidth;canvas.height=innerHeight;draw();}
addEventListener('resize',resize);

function toFloat(c){
  return {
    x:Number(c.bx)/Number(c.b),
    y:Number(c.by)/Number(c.b),
    r:1/Math.abs(Number(c.b)),
    b:c.b
  };
}

function draw(){
  ctx.fillStyle='white';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle='black';
  ctx.fillStyle='black';
  ctx.textAlign='center';
  ctx.textBaseline='middle';

  for(const exact of circles){
    const c=toFloat(exact);
    const x=offsetX+c.x*zoom;
    const y=offsetY-c.y*zoom;
    const r=c.r*zoom;
    if(x+r<0||x-r>canvas.width||y+r<0||y-r>canvas.height) continue;
    ctx.beginPath();
    ctx.arc(x,y,r,0,2*Math.PI);
    ctx.stroke();
    if(r>18){
      ctx.font=Math.min(r*.35,22)+'px sans-serif';
      ctx.fillText(c.b.toString(),x,y);
    }
  }
}

canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  const factor=Math.exp(-e.deltaY*.001);
  const wx=(e.clientX-offsetX)/zoom;
  const wy=-(e.clientY-offsetY)/zoom;
  zoom*=factor;
  offsetX=e.clientX-wx*zoom;
  offsetY=e.clientY+wy*zoom;
  draw();
},{passive:false});

canvas.onmousedown=e=>{dragging=true;last=[e.clientX,e.clientY]};
canvas.onmouseup=()=>dragging=false;
canvas.onmouseleave=()=>dragging=false;
canvas.onmousemove=e=>{
 if(!dragging)return;
 offsetX+=e.clientX-last[0];
 offsetY+=e.clientY-last[1];
 last=[e.clientX,e.clientY];
 draw();
};

resize();
rebuild();
