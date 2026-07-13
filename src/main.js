import { initialConfiguration, generate } from './apollonian.js';

const canvas=document.getElementById('canvas');
const ctx=canvas.getContext('2d');
let zoom=1, offsetX=0, offsetY=0;
let drag=false,last=[0,0];

let circles=generate(initialConfiguration(1),7);

function resize(){canvas.width=innerWidth;canvas.height=innerHeight;draw();}
addEventListener('resize',resize);

function project(c){
 return {x:canvas.width/2+offsetX+c.x*zoom,
         y:canvas.height/2+offsetY+c.y*zoom,
         r:c.r*zoom};
}

function draw(){
 ctx.fillStyle='#02040a';
 ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.strokeStyle='#9ddcff';
 for(const c of circles){
  const p=project(c);
  if(p.r>0.4 && p.r<canvas.width*3){
   ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.stroke();
  }
 }
}

canvas.addEventListener('wheel',e=>{
 e.preventDefault();
 const old=zoom;
 const factor=Math.exp(-e.deltaY*.001);
 const x=e.clientX-canvas.width/2-offsetX;
 const y=e.clientY-canvas.height/2-offsetY;
 zoom*=factor;
 offsetX-=x*(zoom-old);
 offsetY-=y*(zoom-old);
 draw();
},{passive:false});

canvas.onmousedown=e=>{drag=true;last=[e.clientX,e.clientY]};
canvas.onmouseup=()=>drag=false;
canvas.onmouseleave=()=>drag=false;
canvas.onmousemove=e=>{
 if(!drag)return;
 offsetX+=e.clientX-last[0];
 offsetY+=e.clientY-last[1];
 last=[e.clientX,e.clientY];draw();
};

resize();
