// Label space is an inscribed disk in the part of the circle that is visible.
// Using that disk also lets the existing digit/factor layout fit safely.
export function unobstructedLabelRects(width,height,obstacles=[]){
 let rects=[{left:0,right:width,top:0,bottom:height}];
 for(const obstacle of obstacles){
  rects=rects.flatMap(rect=>{
   const left=Math.max(rect.left,obstacle.left),right=Math.min(rect.right,obstacle.right);
   const top=Math.max(rect.top,obstacle.top),bottom=Math.min(rect.bottom,obstacle.bottom);
   if(left>=right||top>=bottom)return [rect];
   return [
    {...rect,right:left},{...rect,left:right},
    {left,right,top:rect.top,bottom:top},{left,right,top:bottom,bottom:rect.bottom}
   ].filter(r=>r.right-r.left>24&&r.bottom-r.top>24);
  });
 }
 return rects;
}

const clamp=(x,low,high)=>Math.max(low,Math.min(high,x));

function candidate(shape,rect,radius){
 const padding=8,left=rect.left+padding+radius,right=rect.right-padding-radius;
 const top=rect.top+padding+radius,bottom=rect.bottom-padding-radius;
 if(left>right||top>bottom)return null;
 const middle={x:(left+right)/2,y:(top+bottom)/2};
 if(shape.type==='rectangle')return middle;
 if(shape.type==='disk'){
  if(!shape.outside){
   const point={x:clamp(shape.x,left,right),y:clamp(shape.y,top,bottom)};
   return Math.hypot(point.x-shape.x,point.y-shape.y)+radius<=shape.r?point:null;
  }
  const corners=[{x:left,y:top},{x:right,y:top},{x:left,y:bottom},{x:right,y:bottom}];
  const point=corners.reduce((best,p)=>Math.hypot(p.x-shape.x,p.y-shape.y)>
   Math.hypot(best.x-shape.x,best.y-shape.y)?p:best);
  return Math.hypot(point.x-shape.x,point.y-shape.y)>=shape.r+radius?point:null;
 }
 const value=p=>shape.nx*p.x+shape.ny*p.y+shape.offset;
 if(value(middle)>=radius)return middle;
 const extreme={x:shape.nx>0?right:shape.nx<0?left:middle.x,
  y:shape.ny>0?bottom:shape.ny<0?top:middle.y};
 if(value(extreme)<radius)return null;
 const shift=radius-value(middle);
 const projected={x:clamp(middle.x+shift*shape.nx,left,right),y:clamp(middle.y+shift*shape.ny,top,bottom)};
 if(value(projected)>=radius-1e-8)return projected;
 const t=(radius-value(middle))/(value(extreme)-value(middle));
 return {x:middle.x+t*(extreme.x-middle.x),y:middle.y+t*(extreme.y-middle.y)};
}

export function placeVisibleLabel(shape,rects){
 if(shape.type==='disk'&&!shape.outside&&shape.r<=10)return null;
 let best=null;
 for(const rect of rects){
  let low=0,high=Math.min(rect.right-rect.left,rect.bottom-rect.top)/2-8;
  if(high<=10||!candidate(shape,rect,0))continue;
  if(shape.type==='disk'&&!shape.outside)high=Math.min(high,shape.r);
  for(let i=0;i<32;i++){
   const size=(low+high)/2;
   if(candidate(shape,rect,size))low=size;else high=size;
  }
  if(low<=10||best&&low<=best.r)continue;
  const point=candidate(shape,rect,low);
  best={...point,r:low};
 }
 return best;
}
