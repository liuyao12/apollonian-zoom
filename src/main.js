import { initialConfiguration, generate } from './apollonian.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let zoom = 1;
let offsetX = 0;
let offsetY = 0;
let dragging = false;
let last = null;

const circles = generate(initialConfiguration(1), 5);

function resize(){
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  draw();
}
addEventListener('resize', resize);

function screen(c){
  return {
    x: canvas.width/2 + offsetX + c.x*zoom,
    y: canvas.height/2 + offsetY + c.y*zoom,
    r: c.r*zoom
  };
}

function draw(){
  ctx.fillStyle='#050505';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle='#ddd';
  ctx.lineWidth=1;
  for(const c of circles){
    const s=screen(c);
    if(s.r>0.2 && s.r<canvas.width*2){
      ctx.beginPath();
      ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
      ctx.stroke();
    }
  }
}

canvas.addEventListener('wheel', e=>{
  e.preventDefault();
  const factor=Math.exp(-e.deltaY*0.001);
  const mx=e.clientX-canvas.width/2-offsetX;
  const my=e.clientY-canvas.height/2-offsetY;
  offsetX-=mx*(factor-1)*zoom;
  offsetY-=my*(factor-1)*zoom;
  zoom*=factor;
  draw();
},{passive:false});

canvas.addEventListener('mousedown',e=>{
 dragging=true; last=[e.clientX,e.clientY];
});
canvas.addEventListener('mouseup',()=>dragging=false);
canvas.addEventListener('mouseleave',()=>dragging=false);
canvas.addEventListener('mousemove',e=>{
 if(!dragging)return;
 offsetX+=e.clientX-last[0];
 offsetY+=e.clientY-last[1];
 last=[e.clientX,e.clientY];
 draw();
});

resize();
