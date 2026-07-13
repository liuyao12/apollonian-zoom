import { generateVisible, toFloat } from './apollonianBigInt.js';
import { presets } from './presets.js';

const canvas=document.getElementById('canvas');
const ctx=canvas.getContext('2d');
const selector=document.getElementById('preset');
for(const name of Object.keys(presets)){const o=document.createElement('option');o.value=name;o.textContent=name;selector.appendChild(o);}

let zoom=600,offsetX=0,offsetY=0,circles=[],error=null,dragging=false,last=[0,0];
let current=Object.keys(presets)[0];

function viewport(){return {left:(0-offsetX)/zoom,right:(canvas.width-offsetX)/zoom,top:offsetY/zoom,bottom:(offsetY-canvas.height)/zoom};}
function update(){try{circles=generateVisible(presets[current],viewport(),zoom);error=null;}catch(e){error=e.stack||String(e);}}
function rebuild(){offsetX=canvas.width/2;offsetY=canvas.height/2;update();draw();}
selector.onchange=()=>{current=selector.value;rebuild();};
function resize(){canvas.width=innerWidth;canvas.height=innerHeight;update();draw();}
addEventListener('resize',resize);

function draw(){
 ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
 if(error){ctx.fillStyle='red';ctx.fillText(error,20,40);return;}
 ctx.strokeStyle='black';ctx.fillStyle='black';ctx.textAlign='center';ctx.textBaseline='middle';
 for(const exact of circles){const c=toFloat(exact);const x=offsetX+c.x*zoom,y=offsetY-c.y*zoom,r=c.r*zoom;
  if(x+r<0||x-r>canvas.width||y+r<0||y-r>canvas.height)continue;
  ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.stroke();
  if(c.b<0n){ctx.font=Math.max(18,r*.25)+'px sans-serif';ctx.fillText('-1',x+r/Math.SQRT2+20,y-r/Math.SQRT2-20);}
  else if(r>10){ctx.font=Math.max(9,Math.min(r*.4,40))+'px sans-serif';ctx.fillText(c.b.toString(),x,y);}
 }
}

canvas.addEventListener('wheel',e=>{e.preventDefault();const f=Math.exp(-e.deltaY*.001);const wx=(e.clientX-offsetX)/zoom,wy=-(e.clientY-offsetY)/zoom;zoom*=f;offsetX=e.clientX-wx*zoom;offsetY=e.clientY+wy*zoom;update();draw();},{passive:false});
canvas.onmousedown=e=>{dragging=true;last=[e.clientX,e.clientY];};
canvas.onmouseup=()=>dragging=false;
canvas.onmousemove=e=>{if(!dragging)return;offsetX+=e.clientX-last[0];offsetY+=e.clientY-last[1];last=[e.clientX,e.clientY];update();draw();};

canvas.width=innerWidth;canvas.height=innerHeight;selector.value=current;rebuild();
