import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {capMesh, disposeCap, updateCapFoil} from './caps.js';

export function createCapPreview({renderer, renderScene, environment, arena, viewport, reduced}) {
 const scene = new THREE.Scene();
 scene.environment = environment;
 scene.environmentIntensity = .65;
 scene.add(new THREE.HemisphereLight('#fff9ea', '#c6c5d8', 1.8));
 const key = new THREE.DirectionalLight('#ffffff', 2.4);
 key.position.set(-3, 4, 6);
 scene.add(key);

 const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
 const canvas = renderer.domElement;
 const orbit = new OrbitControls(camera, canvas);
 orbit.enabled = false;
 orbit.enablePan = false;
 orbit.minDistance = 3.5;
 orbit.maxDistance = 8;
 orbit.rotateSpeed = .8;
 let mesh;

 function resize() {
  if (!mesh) return;
  const {width, height} = viewport.getBoundingClientRect();
  if (!width || !height) return;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
 }
 new ResizeObserver(resize).observe(viewport);

 function close() {
  if (!mesh) return;
  orbit.enabled = false;
  arena.append(canvas);
  const previous = mesh;
  mesh = null;
  previous.removeFromParent();
  previous.userData.ready.then(() => disposeCap(previous), () => disposeCap(previous));
 }

 return {
  open(dragon) {
   close();
   mesh = capMesh(dragon);
   mesh.rotation.x = Math.PI / 2;
   mesh.material[2].map.rotation += Math.PI;
   mesh.visible = false;
   scene.add(mesh);
   viewport.append(canvas);
   camera.position.set(.55, .6, 4.6);
   orbit.update();
   orbit.enabled = true;
   resize();
   const current = mesh;
   return current.userData.ready.then(() => {
    if (mesh === current) current.visible = true;
   });
  },
  rotate(angle) {
   camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
   orbit.update();
  },
  draw(time) {
   if (!mesh) return;
   updateCapFoil(mesh, reduced ? 0 : time / 1000, camera);
   renderScene(scene, camera);
  },
  close,
 };
}
