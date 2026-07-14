export const ARC_LINE_TOLERANCE_PX=.25;

export function circleBoundaryPrimitive(x,y,r,width,height,tolerance=ARC_LINE_TOLERANCE_PX){
 if(![x,y,r,width,height].every(Number.isFinite)||r<=0)return {type:'none'};
 if(x+r<0||x-r>width||y+r<0||y-r>height)return {type:'none'};

 const diagonal=Math.hypot(width,height);
 // The sagitta is the greatest separation between this circle and its
 // tangent across a viewport-sized chord. Below a fraction of a pixel, the
 // canvas arc is visually just a line and large coordinates only hurt it.
 const sagitta=diagonal*diagonal/(8*r);
 if(sagitta>tolerance)return {type:'arc',x,y,r};

 const centerX=width/2,centerY=height/2;
 const dx=centerX-x,dy=centerY-y,distance=Math.hypot(dx,dy);
 if(!Number.isFinite(distance)||distance===0)return {type:'none'};

 const nx=dx/distance,ny=dy/distance;
 const signedDistance=distance-r;
 const viewportExtent=Math.abs(nx)*width/2+Math.abs(ny)*height/2;
 if(Math.abs(signedDistance)>viewportExtent+tolerance)return {type:'none'};

 const qx=centerX-signedDistance*nx,qy=centerY-signedDistance*ny;
 const tx=-ny,ty=nx,halfLength=diagonal+tolerance;
 return {
  type:'line',
  x1:qx-tx*halfLength,y1:qy-ty*halfLength,
  x2:qx+tx*halfLength,y2:qy+ty*halfLength
 };
}
