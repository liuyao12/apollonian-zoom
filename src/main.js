const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// A Mandelbrot-style explorer architecture:
// circles are generated from Descartes configurations on demand.
// This first version uses recursive local generation rather than
// pre-rendering generations.

let zoom = 1;
let centerX = 0;
let centerY = 0;
let dragging = false;
let lastX = 0;
let lastY = 0;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
}
window.addEventListener('resize', resize);

function circle(x, y, r) {
  return { x, y, r };
}

// Initial Descartes configuration:
// three unit circles in a triangular arrangement and the enclosing circle.
function initialCircles() {
  const a = 200;
  const h = a * Math.sqrt(3);
  return [
    circle(0, 0, a),
    circle(-a, 0, a),
    circle(a, 0, a),
    circle(0, h, a)
  ];
}

// Placeholder recursive gap subdivision.
// Next step replaces this with exact Descartes bend arithmetic.
function generate(level, circles, out) {
  for (const c of circles) out.push(c);
  if (level <= 0) return;

  for (let i = 0; i < circles.length; i++) {
    const c = circles[i];
    if (c.r < 2) continue;
    const r = c.r / 2;
    generate(level - 1, [
      circle(c.x + r, c.y, r),
      circle(c.x - r, c.y, r),
      circle(c.x, c.y + r, r)
    ], out);
  }
}

function draw() {
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.translate(centerX, centerY);
  ctx.scale(zoom, zoom);

  ctx.strokeStyle = '#55ddff';
  ctx.lineWidth = 1 / zoom;

  const circles = [];
  generate(4, initialCircles(), circles);

  for (const c of circles) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = Math.exp(-e.deltaY * 0.001);
  zoom *= factor;
  draw();
}, { passive: false });

canvas.addEventListener('mousedown', e => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
});

window.addEventListener('mouseup', () => dragging = false);

window.addEventListener('mousemove', e => {
  if (!dragging) return;
  centerX += e.clientX - lastX;
  centerY += e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  draw();
});

resize();
