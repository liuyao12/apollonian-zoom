const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
}
window.addEventListener('resize', resize);

let zoom = 1;
let offsetX = 0;
let offsetY = 0;

function drawCircle(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.stroke();
}

// First prototype: replace with Descartes recursion.
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2 + offsetX, canvas.height / 2 + offsetY);
  ctx.scale(zoom, zoom);
  ctx.strokeStyle = '#fff';
  drawCircle(0, 0, 200);
  drawCircle(-100, 0, 100);
  drawCircle(100, 0, 100);
  drawCircle(0, 173.205, 100);
  ctx.restore();
}

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  zoom *= Math.exp(-e.deltaY * 0.001);
  draw();
}, {passive:false});

resize();
