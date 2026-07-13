import { generate } from './apollonianBigInt.js';
import { presets } from './presets.js';

const canvas=document.getElementById('canvas');
const ctx=canvas.getContext('2d');
let zoom=420;
let offsetX=0, offsetY=0;
let dragging=false,last=[0,0];
let current=presets.Classic;
let circles=[];

function rebuild(){
  circles=generate(current,8);
  offsetX=canvas.width/2;
  offsetY=canvas.height/2;
}

function resize(){canvas.width=innerWidth;canvas.height=innerHeight;draw();}
addEventListener('resize',resize);

function project(c){
 return {x:offsetX+c.x*zoom,y:offsetY-c.y*zoom,r:c.r*zoom};
}

function draw(){
 ctx.fillStyle='#02040a';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.strokeStyle='#9ddcff';
 ctx.fillStyle='#ffffff';
 ctx.textAlign='center';
 ctx.textBaseline='middle';
 for(const c of circles){
  const p=project(c);
  if(p.r>0.2 && p.r<canvas.width*3){
   ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,2*Math.PI);ctx.stroke();
   if(p.r>12){
    ctx.font=Math.min(Math.max(p.r*0.35,10),24)+'px sans-serif';
    ctx.fillText(c.b.toString(),p.x,p.y);
   }
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
 last=[e.clientX,e.clientY];draw();
};

resize();
rebuild();
draw();
