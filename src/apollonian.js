// Apollonian circle packing engine
// Circles are represented as {x,y,r}.  This module uses Descartes' theorem
// to replace one circle in a tangent quadruple.

export function descartesOther(circles, replace = 3) {
  const bs = circles.map(c => 1 / c.r);
  const xs = circles.map(c => c.x / c.r);
  const ys = circles.map(c => c.y / c.r);

  const b = 2 * (bs[0] + bs[1] + bs[2]) - bs[replace];
  const bx = 2 * (xs[0] + xs[1] + xs[2]) - xs[replace];
  const by = 2 * (ys[0] + ys[1] + ys[2]) - ys[replace];

  return { x: bx / b, y: by / b, r: 1 / Math.abs(b) };
}

export function initialConfiguration(scale = 1) {
  const r = 100 * scale;
  return [
    {x:0,y:0,r:200*scale},
    {x:-100*scale,y:0,r},
    {x:100*scale,y:0,r},
    {x:0,y:173.20508075688772*scale,r}
  ];
}

export function generate(circles, depth) {
  if (depth <= 0) return circles;
  const result = [...circles];
  const seen = new Set();
  function key(c){return `${c.x.toFixed(6)},${c.y.toFixed(6)},${c.r.toFixed(6)}`}
  function walk(q,n){
    if(n===0)return;
    for(let i=0;i<4;i++){
      const c=descartesOther(q,i);
      const k=key(c);
      if(!seen.has(k)){
        seen.add(k); result.push(c);
        const nq=[...q]; nq[i]=c;
        walk(nq,n-1);
      }
    }
  }
  walk(circles, depth);
  return result;
}
