import { initialConfiguration, generate } from './apollonianBigInt.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let zoom = 800;
let offsetX = 0;
let offsetY = 0;
let dragging = false;
let last = [0,0];

// Generate exact integral Apollonian packing.
const circles = generate(initialConfiguration(), 8);

function resize(){
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  draw();
}
addEventListener('resize',resize);

function project(c){
  return {
    x: canvas.width/2 + offsetX + c.x*zoom,
    y: canvas.height/2 + offsetY - c.y*zoom,
    r: c.r*zoom
  };
}

function draw(){
  ctx.fillStyle='#02040a';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle='#9ddcff';
  ctx.lineWidth=1;
  for(const c of circles){
    const p=project(c);
    if(p.r>0.2 && p.r<canvas.width*4){
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,2*Math.PI);
      ctx.stroke();
    }
  }
}

canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  const factor=Math.exp(-e.deltaY*0.001);
  const wx=(e.clientX-canvas.width/2-offsetX)/zoom;
  const wy=-(e.clientY-canvas.height/2-offsetY)/zoom;
  zoom*=factor;
  offsetX=e.clientX-canvas.width/2-wx*zoom;
  offsetY=e.clientY-canvas.height/2+wy*zoom;
  draw();
},{passive:false});

canvas.onmousedown=e=>{
  dragging=true;
  last=[e.clientX,e.clientY];
};
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
