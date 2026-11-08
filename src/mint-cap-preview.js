import {backImage, dragons, frontImage, isFound} from './cap-catalog.js';

const stage = document.querySelector('.mint-cap-stage');
const fallback = stage.querySelector('img');
const title = document.querySelector('#mint-cap-name');
const hint = document.querySelector('#mint-cap-hint');
const controls = document.querySelector('.mint-cap-controls');
const picks = [...controls.querySelectorAll('[data-cap]')];
const flip = document.querySelector('#mint-cap-flip');
const caps = picks.map(button => dragons.find(cap => isFound(cap) && cap.originalId === Number(button.dataset.cap)));

let active = 0;
let showBack = false;
let viewer;

function updateFallback() {
 const cap = caps[active];
 fallback.src = showBack ? backImage(cap) : frontImage(cap);
 fallback.alt = (showBack ? 'Back' : 'Front') + ' of ' + title.textContent;
}

picks.forEach((button, index) => button.addEventListener('click', () => {
 if (active === index) return;
 active = index;
 showBack = false;
 title.textContent = button.getAttribute('aria-label');
 picks.forEach((pick, i) => pick.setAttribute('aria-pressed', String(i === index)));
 updateFallback();
 viewer?.select();
}));

flip.addEventListener('click', () => {
 showBack = !(viewer?.isBack() ?? showBack);
 updateFallback();
 viewer?.flip();
});
controls.hidden = false;

async function startViewer() {
 const [THREE, {capMesh, disposeCap}] = await Promise.all([import('three'), import('./caps.js')]);
 const renderer = new THREE.WebGLRenderer({alpha:true, antialias:true, powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
 const canvas = renderer.domElement;
 canvas.hidden = true;
 canvas.tabIndex = 0;
 canvas.setAttribute('role', 'img');
 canvas.setAttribute('aria-label', '3D Found Cap. Drag or use the arrow keys to rotate.');
 const camera = new THREE.PerspectiveCamera(35, 1, .1, 20);
 camera.position.z = 4.5;
 const scene = new THREE.Scene();
 scene.add(new THREE.HemisphereLight('#fff9ea', '#d0c3b0', 1.8));
 const light = new THREE.DirectionalLight('#fff5e0', 2.1);
 light.position.set(-3, 4, 5);
 scene.add(light);

 const pivot = new THREE.Group();
 pivot.rotation.order = 'YXZ';
 scene.add(pivot);
 const models = new Map();
 let current;
 let drag;
 let pendingFrame = 0;
 let contextLost = false;
 let flipFrame = 0;
 let selection = 0;
 const reduced = matchMedia('(prefers-reduced-motion: reduce)');

 function draw() {
  if (pendingFrame || contextLost) return;
  pendingFrame = requestAnimationFrame(() => {
   pendingFrame = 0;
   renderer.render(scene, camera);
  });
 }

 function resize() {
  const {clientWidth:w, clientHeight:h} = stage;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  draw();
 }

 function resetPose() {
  cancelAnimationFrame(flipFrame);
  flipFrame = 0;
  pivot.rotation.set(showBack ? 0 : -.22, showBack ? Math.PI : -.20, 0);
 }

 function reveal(ready) {
  canvas.hidden = !ready;
  fallback.hidden = ready;
  hint.hidden = !ready;
 }

 async function select() {
  const selected = active;
  const ticket = ++selection;
  reveal(false);
  current?.removeFromParent();
  current = undefined;
  resetPose();
  let cap = models.get(selected);
  if (!cap) {
   cap = capMesh(caps[selected]);
   cap.rotation.x = Math.PI / 2;
   cap.material[2].map.rotation += Math.PI;
   models.set(selected, cap);
  }
  try {
   await cap.userData.ready;
  } catch {
   if (models.get(selected) === cap) {
    models.delete(selected);
    disposeCap(cap);
   }
   return;
  }
  if (ticket !== selection || contextLost) return;
  current = cap;
  pivot.add(cap);
  reveal(true);
  draw();
 }

 function rotate(dx, dy) {
  cancelAnimationFrame(flipFrame);
  flipFrame = 0;
  pivot.rotation.y += dx;
  pivot.rotation.x = THREE.MathUtils.clamp(pivot.rotation.x + dy, -1.25, 1.25);
  draw();
 }

 canvas.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  drag = {id:event.pointerId, x:event.clientX, y:event.clientY};
  canvas.setPointerCapture(event.pointerId);
 });
 canvas.addEventListener('pointermove', event => {
  if (drag?.id !== event.pointerId) return;
  rotate((event.clientX - drag.x) * .012, (event.clientY - drag.y) * .012);
  drag.x = event.clientX;
  drag.y = event.clientY;
 });
 for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(name, event => { if (drag?.id === event.pointerId) drag = undefined; });
 }
 canvas.addEventListener('keydown', event => {
  const steps = {ArrowLeft:[-.2,0], ArrowRight:[.2,0], ArrowUp:[0,-.2], ArrowDown:[0,.2]};
  if (!steps[event.key]) return;
  event.preventDefault();
  rotate(...steps[event.key]);
 });
 canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  contextLost = true;
  reveal(false);
 });
 canvas.addEventListener('webglcontextrestored', () => {
  contextLost = false;
  void select();
 });

 stage.append(canvas);
 new ResizeObserver(resize).observe(stage);
 resize();
 viewer = {select, isBack() {
  return current && !contextLost && !flipFrame ? Math.cos(pivot.rotation.y) < 0 : showBack;
 }, flip() {
  cancelAnimationFrame(flipFrame);
  if (reduced.matches || contextLost || !current) {
   resetPose();
   draw();
   return;
  }
  const from = pivot.rotation.y;
  const tilt = pivot.rotation.x;
  const side = showBack ? Math.PI : 0;
  const to = side + 2 * Math.PI * Math.round((from - side) / (2 * Math.PI));
  const started = performance.now();
  function step(now) {
   const t = Math.min(1, (now - started) / 310);
   const ease = 1 - (1 - t) ** 3;
   pivot.rotation.y = THREE.MathUtils.lerp(from, to, ease);
   pivot.rotation.x = THREE.MathUtils.lerp(tilt, 0, ease);
   draw();
   flipFrame = t < 1 ? requestAnimationFrame(step) : 0;
  }
  flipFrame = requestAnimationFrame(step);
 }};
 await select();
}

startViewer().catch(() => {
 // The static front and back remain usable if WebGL is unavailable.
});
