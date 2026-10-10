export const ARC_LINE_TOLERANCE_PX=.25;

// This helper handles arcs only. Lines must be constructed from the exact
// circle equation in exactViewport, never from rounded centers and radii.
export function circleBoundaryPrimitive(x,y,r,width,height){
 if(![x,y,r,width,height].every(Number.isFinite)||r<=0)return {type:'none'};
 if(x+r<0||x-r>width||y+r<0||y-r>height)return {type:'none'};

 return {type:'arc',x,y,r};
}
