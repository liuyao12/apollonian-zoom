// Labels use the area centroid of the circle portion inside the viewport.
// Integrate clipped vertical slices in viewport-local coordinates. Avoid
// subtracting large circle moments, which loses precision near the line limit.
function diskCentroid(shape,rect){
 const {x:cx,y:cy,r}=shape;
 const left=Math.max(rect.left,cx-r),right=Math.min(rect.right,cx+r);
 if(left>=right)return null;
 const cuts=[left,right],width=rect.right-rect.left,height=rect.bottom-rect.top;
 for(const edge of [rect.top,rect.bottom]){
  const dy=edge-cy;
  if(Math.abs(dy)<r){
   const dx=Math.sqrt((r-dy)*(r+dy));
   for(const x of [cx-dx,cx+dx])if(x>left&&x<right)cuts.push(x);
  }
 }
 cuts.sort((a,b)=>a-b);
 const slice=x=>{
  const dx=x-cx,h=Math.sqrt(Math.max(0,(r-dx)*(r+dx)));
  const top=Math.max(rect.top,cy-h),bottom=Math.min(rect.bottom,cy+h);
  const area=Math.max(0,bottom-top);
  return [area,area*(x-rect.left)/width,area*((top+bottom)/2-rect.top)/height];
 };
 const simpson=(a,b,fa,fm,fb)=>fa.map((v,i)=>(b-a)*(v+4*fm[i]+fb[i])/6);
 const integrate=(a,b,fa,fm,fb,whole,tolerance,depth)=>{
  const mid=(a+b)/2,fl=slice((a+mid)/2),fr=slice((mid+b)/2);
  const l=simpson(a,mid,fa,fl,fm),r=simpson(mid,b,fm,fr,fb);
  const sum=l.map((v,i)=>v+r[i]);
  if(!depth||Math.max(...sum.map((v,i)=>Math.abs(v-whole[i])))<=15*tolerance)
   return sum.map((v,i)=>v+(v-whole[i])/15);
  const il=integrate(a,mid,fa,fl,fm,l,tolerance/2,depth-1);
  const ir=integrate(mid,b,fm,fr,fb,r,tolerance/2,depth-1);
  return il.map((v,i)=>v+ir[i]);
 };
 const total=[0,0,0];
 for(let i=1;i<cuts.length;i++){
  const a=cuts[i-1],b=cuts[i],fa=slice(a),fm=slice((a+b)/2),fb=slice(b);
  const part=integrate(a,b,fa,fm,fb,simpson(a,b,fa,fm,fb),width*height*1e-10/cuts.length,18);
  part.forEach((v,j)=>total[j]+=v);
 }
 return total[0]>0?{x:rect.left+width*total[1]/total[0],y:rect.top+height*total[2]/total[0]}:null;
}

function halfPlaneCentroid(shape,rect){
 const polygon=[{x:rect.left,y:rect.top},{x:rect.right,y:rect.top},
  {x:rect.right,y:rect.bottom},{x:rect.left,y:rect.bottom}];
 const value=p=>shape.nx*p.x+shape.ny*p.y+shape.offset;
 const clipped=[];
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],va=value(a),vb=value(b);
  if(va>=0)clipped.push(a);
  if((va>=0)!==(vb>=0)){
   const t=va/(va-vb);clipped.push({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});
  }
 }
 let area=0,mx=0,my=0;
 for(let i=0;i<clipped.length;i++){
  const a=clipped[i],b=clipped[(i+1)%clipped.length],cross=a.x*b.y-b.x*a.y;
  area+=cross;mx+=(a.x+b.x)*cross;my+=(a.y+b.y)*cross;
 }
 return area?{x:mx/(3*area),y:my/(3*area)}:null;
}

// Negative labels hug the boundary on the side pointing away from the center.
function exteriorLabel(shape,rect){
 const middle={x:(rect.left+rect.right)/2,y:(rect.top+rect.bottom)/2};
 const offscreen=shape.x<rect.left||shape.x>rect.right||shape.y<rect.top||shape.y>rect.bottom;
 const directions=[offscreen?middle:{x:shape.x+1,y:shape.y-1},
  {x:rect.right,y:rect.top},{x:rect.left,y:rect.top},
  {x:rect.right,y:rect.bottom},{x:rect.left,y:rect.bottom},
  {x:middle.x,y:rect.top},{x:rect.right,y:middle.y},
  {x:middle.x,y:rect.bottom},{x:rect.left,y:middle.y}];
 for(const target of directions){
  const dx=target.x-shape.x,dy=target.y-shape.y,length=Math.hypot(dx,dy);
  if(!length)continue;
  const candidate=radius=>{
   const distance=shape.r+radius+8;
   const point={x:shape.x+dx/length*distance,y:shape.y+dy/length*distance};
   return fitsViewport(point,radius,rect)?point:null;
  };
  const label=fitBoundaryLabel(candidate);
  if(label)return label;
 }
 return null;
}

function fitsViewport(point,radius,rect){
 return point.x-radius>=rect.left+8&&point.x+radius<=rect.right-8&&
  point.y-radius>=rect.top+8&&point.y+radius<=rect.bottom-8;
}
function fitBoundaryLabel(candidate){
 if(!candidate(0))return null;
 let low=0,high=80;
 for(let i=0;i<32;i++){
  const mid=(low+high)/2;
  if(candidate(mid))low=mid;else high=mid;
 }
 return low>10?{...candidate(low),r:low}:null;
}

function exteriorLineLabel(shape,rect){
 const candidate=radius=>{
  const left=rect.left+8+radius,right=rect.right-8-radius;
  const top=rect.top+8+radius,bottom=rect.bottom-8-radius;
  if(left>right||top>bottom)return null;
  const offset=shape.offset-radius-8,points=[];
  if(shape.ny)for(const x of [left,right]){
   const y=-(shape.nx*x+offset)/shape.ny;
   if(y>=top&&y<=bottom)points.push({x,y});
  }
  if(shape.nx)for(const y of [top,bottom]){
   const x=-(shape.ny*y+offset)/shape.nx;
   if(x>=left&&x<=right)points.push({x,y});
  }
  if(!points.length)return null;
  return {x:points.reduce((sum,p)=>sum+p.x,0)/points.length,
   y:points.reduce((sum,p)=>sum+p.y,0)/points.length};
 };
 return fitBoundaryLabel(candidate);
}

export function placeVisibleLabel(shape,rects){
 const rect=rects[0];
 if(!rect)return null;
 if(shape.outside)return shape.type==='disk'?exteriorLabel(shape,rect):exteriorLineLabel(shape,rect);
 let point;
 if(shape.type==='disk'){
  if(shape.r<=10)return null;
  const fullyVisible=shape.x-shape.r>=rect.left&&shape.x+shape.r<=rect.right&&
   shape.y-shape.r>=rect.top&&shape.y+shape.r<=rect.bottom;
  point=fullyVisible?{x:shape.x,y:shape.y}:diskCentroid(shape,rect);
 }else if(shape.type==='halfPlane')point=halfPlaneCentroid(shape,rect);
 else point={x:(rect.left+rect.right)/2,y:(rect.top+rect.bottom)/2};
 if(!point)return null;
 let radius=Math.min(point.x-rect.left-8,rect.right-point.x-8,
  point.y-rect.top-8,rect.bottom-point.y-8);
 if(shape.type==='disk')radius=Math.min(radius,shape.r-Math.hypot(point.x-shape.x,point.y-shape.y));
 if(shape.type==='halfPlane')radius=Math.min(radius,shape.nx*point.x+shape.ny*point.y+shape.offset);
 return radius>10?{...point,r:radius}:null;
}
