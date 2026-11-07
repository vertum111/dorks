// Native SVG parts: no generated video, spritesheets or external animation service.
export function outcomeDragon(won){return `<svg class="outcome-dragon ${won?'dragon-won':'dragon-lost'}" viewBox="0 0 360 330" role="img" aria-label="${won?'Happy green dragon celebrating':'Sad red dragon sulking'}" xmlns="http://www.w3.org/2000/svg">
 <ellipse class="dragon-shadow" cx="176" cy="309" rx="92" ry="10" fill="#303436" opacity=".12"/>
 <g class="dragon-character" stroke="#303436" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
  <path class="dragon-tail" d="M248 253q61 22 56-18c-2-22-37-18-29 0 4 9 16 4 12-2" fill="none" stroke="var(--dragon-body)" stroke-width="18"/>
  <path class="dragon-tail" d="M248 253q61 22 56-18c-2-22-37-18-29 0 4 9 16 4 12-2" fill="none"/>
  <path class="dragon-wing wing-left" d="M116 164q-45-40-65 4l21-6 12 21 13-19 19 10" fill="#739b97"/>
  <path class="dragon-wing wing-right" d="M229 165q45-41 65 1l-21-4-11 20-12-18-19 13" fill="#739b97"/>
  <path d="m123 78-8-28q-1-12 9-18l12 7 5 32m65-12 4-32q1-10 11-9l9 10-2 36" fill="#fff0cb"/>
  <path d="M112 146C71 142 57 115 67 95 78 66 121 62 162 65c51-32 114-16 122 15 11 38-23 55-59 64-10 3-22 7-16 20 14 23 47 44 44 90-1 24-7 39-18 46l-1 12-28 1-4-10-55 1-6 10-26-3-1-13c-29-24-23-68-9-96 11-22 24-40 7-56Z" fill="var(--dragon-body)"/>
  <path d="M128 226c9-22 49-34 72-12 21 19 32 68 7 80-23 11-66 5-76-6-10-12-13-43-3-62Z" fill="#fff0cb" stroke="none"/>
  <g class="dragon-eyes" fill="#303436" stroke="none"><circle cx="106" cy="108" r="4.4"/><circle cx="251" cy="86" r="4.4"/></g>
  ${won?'<path d="M156 117q29 16 60-6" fill="none"/><path d="m181 124 1 12 12-1-1-13" fill="#fff8e7"/>':'<path d="M159 128q26-19 53-13" fill="none"/><path d="m180 116 1 11 11-1-1-13" fill="#fff8e7"/><path class="dragon-tear" d="m251 99-6 13q-1 10 8 9c10-2 4-14-2-22Z" fill="#8ecbd1" stroke-width="2"/>'}
  <g class="dragon-arm arm-left" fill="none"><path d="${won?'M120 197 88 172 72 141m0 0-10-8m10 8 7-11m-7 11-11 5':'M118 194 98 229l-1 17m1-17-10 7m10-7 7 13'}"/></g>
  <g class="dragon-arm arm-right" fill="none"><path d="${won?'M234 198 268 175l16-32m0 0-5-13m5 13 12-6m-12 6 10 7':'M237 195 258 230l1 16m-1-16 10 7m-10-7-7 13'}"/></g>
  ${won?'<path class="dragon-crown" d="m139 49-11-26 24 9 14-22 12 22 23-12-8 29Z" fill="#f9d47c"/>':''}
 </g>
 ${won?'<g class="dragon-sparkles" fill="#f9d47c" stroke="#303436" stroke-width="2"><path d="m53 60 4 10 11 3-10 5-4 11-4-11-11-3 11-5Z"/><path d="m305 96 3 8 9 3-8 4-4 9-3-9-9-3 9-4Z"/><path d="m290 32 7 13-10 5-7-13Z" fill="#b9d5ab"/></g>':''}
</svg>`;}
