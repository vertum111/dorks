// Rebuild the printable Found faces from the existing dragon art (ImageMagick 7 and CairoSVG).
import {spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {originalCaps, frontImage} from '../src/cap-catalog.js';

const scratch = mkdtempSync(join(tmpdir(), 'dorks-found-'));
const output = 'public/art/found';
mkdirSync(output, {recursive:true});
const side = 512;

function run(command, ...args) {
 const result = spawnSync(command, args, {encoding:'utf8'});
 if (result.status !== 0) throw new Error(result.stderr || result.error?.message);
}

function weather(seed, back) {
 let state = seed;
 const roll = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2**32);
 const marks = ['<rect width="512" height="512" fill="#a58b5a" opacity=".11"/>'];
 // Dirt gathers mostly around the rim, with several overlapping patches.
 const patches = Array.from({length:5}, () => {
  const a = roll() * Math.PI * 2, r = 157 + roll() * 75;
  return [256 + Math.cos(a)*r, 256 + Math.sin(a)*r];
 });
 for (let i=0; i<710; i++) {
  const [x,y] = patches[i % patches.length];
  const dx=(roll()+roll()-1)*88, dy=(roll()+roll()-1)*68;
  marks.push(`<ellipse cx="${(x+dx).toFixed(1)}" cy="${(y+dy).toFixed(1)}" rx="${(.35+roll()*4).toFixed(1)}" ry="${(.3+roll()*2).toFixed(1)}" fill="${i%3?'#614329':'#332418'}" opacity="${(.12+roll()*.35).toFixed(2)}"/>`);
 }
 // The paper shows through angular chips of different widths and depths.
 const phase = roll() * Math.PI * 2;
 const at = (angle, radius) => [
  (256 + Math.cos(angle) * radius).toFixed(1),
  (256 + Math.sin(angle) * radius).toFixed(1),
 ].join(',');
 const sectorCount = 17 + Math.floor(roll() * 6);
 const sectorWidth = Math.PI * 2 / sectorCount;
 const boundary = [];
 const flakes = [];
 for (let i = 0; i < sectorCount; i++) {
  const angle = phase + i * sectorWidth;
  const rim = 242 + roll() * 17;
  const mouth = .42 + roll() * .48;
  const depth = 10 + roll() ** 1.4 * 42;
  const tip = mouth * (.23 + roll() * .4);
  // Two stretches retain the round edge of the original print.
  const secondArc = Math.floor(sectorCount / 2);
  const intact = i < 4 || (i >= secondArc && i < secondArc + 3);
  if (intact) {
   for (let point = 0; point < 8; point++) {
    boundary.push(at(angle + sectorWidth * point / 8, 246));
   }
  } else boundary.push(
   at(angle, rim),
   at(angle + sectorWidth * tip * .62, rim - depth * .45),
   at(angle + sectorWidth * tip, rim - depth),
   at(angle + sectorWidth * mouth * .73, rim - depth * .54),
   at(angle + sectorWidth * mouth, rim - roll() * 7),
  );
  for (let j = 0; j < 5; j++) {
   const flakeAngle = angle + roll() * sectorWidth * mouth;
   const radius = rim - depth - 3 - roll() * 12;
   const points = [
    at(flakeAngle, radius),
    at(flakeAngle + .009 + roll() * .022, radius - 1 - roll() * 6),
    at(flakeAngle + .028, radius + 1 + roll() * 4),
   ];
   if (!intact) flakes.push('<polygon points="' + points.join(' ') + '" fill="#f5f1e8" opacity=".65"/>');
  }
 }
 const edge = 'M' + boundary.join('L') + 'Z';
 const paper = '<path d="M0 0H512V512H0Z ' + edge + '" fill="#f5f1e8" fill-rule="evenodd"/>';
 // Feather only the ink at the boundary. Dirt and scratches stay sharp.
 const feather = Array.from({length:12}, (_, i) => {
  const width = 31 - i * 2;
  const opacity = (.065 + i * i * .0045).toFixed(3);
  return '<path d="' + edge + '" fill="none" stroke="#f5f1e8" stroke-linejoin="round" stroke-width="' + width + '" opacity="' + opacity + '"/>';
 });
 marks.splice(1, 0, paper, ...feather, ...flakes);
 for (let i=0; i<28; i++) {
  const x=45+roll()*422,y=48+roll()*416,dx=12+roll()*62,dy=(roll()-.5)*43;
  const path=`M${x.toFixed(1)} ${y.toFixed(1)} q${(dx*.45).toFixed(1)} ${(dy*.75).toFixed(1)} ${dx.toFixed(1)} ${dy.toFixed(1)}`;
  marks.push(`<path d="${path}" fill="none" stroke="${i%3?'#fff0ca':'#60462f'}" stroke-width="${(.7+roll()*1.6).toFixed(1)}" opacity="${(.18+roll()*.38).toFixed(2)}" stroke-linecap="round"/>`);
 }
 if(back) marks.push('<path d="M83 332Q145 314 169 340M90 337q23-4 39 4" fill="none" stroke="#57412d" stroke-width="2.5" opacity=".48"/>');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 512 512">${marks.join('')}</svg>`;
}

try {
 const layer=join(scratch,'weather.svg');
 const layerPng=join(scratch,'weather.png');
 const backPng=join(scratch,'back.png');
 run('cairosvg','public/brand/cap-back.svg','-o',backPng);
 for(const dragon of originalCaps) {
  for(const face of ['front','back']) {
   const back=face==='back';
   writeFileSync(layer,weather(dragon.id * 709 + (back ? 9173 : 0),back));
   run('cairosvg',layer,'-o',layerPng);
   const base=back ? [backPng] : dragon.sprite
    ? ['-size','512x512',`xc:${dragon.color}`,'(',`public${frontImage(dragon)}`,'-resize','436x436',')','-gravity','center','-compose','over','-composite']
    : [`public${frontImage(dragon)}`];
   run('magick',...base,'-resize','512x512!','-background','#c4ac83','-alpha','remove','-alpha','off',
    '-modulate','94,61,100',layerPng,'-compose','over','-composite','-strip','-colors','192',
    `PNG8:${output}/${dragon.id}-${face}.png`);
  }
 }
} finally {
 rmSync(scratch,{recursive:true,force:true});
}
console.log(`Generated ${originalCaps.length} two-sided Found designs.`);
