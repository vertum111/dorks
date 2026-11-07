// Original DORKS foil finishes; the stamp is the supplied brand mark, not a card-game asset.
export const FOIL_FINISHES={
 etched:{index:0,label:'Etched silver',grid:[6,5],colors:['#d8e8da','#b8cbdc','#e6c4df','#cce8df'],base:'#d5ddd9'},
 cosmos:{index:1,label:'Cosmic holo',grid:[3,3],colors:['#20274f','#63518d','#253b69','#a679ab'],base:'#20274f'},
 prism:{index:2,label:'Prismatic gold',grid:[4,4],colors:['#f4d991','#efb8cd','#bcdece','#cfb9e8'],base:'#e5ca89'}
};
export const foilFinish=mode=>FOIL_FINISHES[mode]||FOIL_FINISHES.prism;
export const foilUniforms=`
 uniform float dorksFoilTime;
 uniform float dorksFoilMode;
 uniform sampler2D dorksFoilMask;
 uniform sampler2D dorksFoilStamp;
 uniform vec3 dorksFoilView;
 uniform vec2 dorksFoilGrid;
`;
export const foilFragment=`
 float backgroundMask=(1.0-texture2D(dorksFoilMask,vMapUv).a)*(1.0-smoothstep(.462,.486,length(vMapUv-.5)));
 vec2 uv=vMapUv;
 vec2 tilt=dorksFoilView.xz;
 float incidence=abs(dorksFoilView.y);
 float spectral=dot(uv,vec2(1.25,.82))+dot(tilt,vec2(1.6,-1.2));
 vec3 rainbow=.5+.5*cos(6.283185*(spectral+vec3(0.,.333,.667)));
 vec3 foilColor;
 float glint=0.;
 if(dorksFoilMode<.5){
  // Fine silver engraving, broken diagonal diffraction and little cut facets.
  vec2 facets=floor(uv*vec2(25.,31.));
  float grain=fract(sin(dot(facets,vec2(127.1,311.7)))*43758.5453);
  float engraving=pow(.5+.5*sin((uv.x+uv.y)*820.+tilt.x*35.),14.);
  float cross=pow(.5+.5*sin((uv.x-uv.y)*160.+tilt.y*22.),20.);
  float shard=smoothstep(.5,.97,sin(grain*32.+dot(tilt,vec2(9.,7.))));
  foilColor=mix(vec3(.47,.63,.64),vec3(.85,.86,.78),grain*.55+.22);
  foilColor=mix(foilColor,rainbow*.62+.25,.28+shard*.22);
  glint=engraving*.14+cross*shard*.27;
 }else if(dorksFoilMode<1.5){
  // Deep indigo nebula with discrete, angle-lit star and bubble inclusions.
  float nebula=.5+.5*sin(uv.x*8.+sin(uv.y*9.)*2.+tilt.x*2.);
  foilColor=mix(vec3(.07,.10,.24),vec3(.34,.19,.49),nebula);
  foilColor+=rainbow*.17;
  vec2 starCell=floor(uv*34.);vec2 starPoint=fract(uv*34.)-.5;
  float seed=fract(sin(dot(starCell,vec2(127.1,311.7)))*43758.5453);
  float sparkle=step(.88,seed)*pow(max(0.,sin(seed*81.+dot(tilt,vec2(19.,13.))+dorksFoilTime*.16)),6.);
  float star=(1.-smoothstep(.015,.15,length(starPoint)))+.35*(1.-smoothstep(.015,.045,abs(starPoint.x)))*(1.-smoothstep(.06,.30,abs(starPoint.y)));
  vec2 bubble=fract(uv*9.+vec2(.2,.45))-.5;
  float ring=(1.-smoothstep(.018,.04,abs(length(bubble)-.24)))*smoothstep(.3,.9,sin(uv.x*17.+dot(tilt,vec2(12.,-8.))));
  glint=star*sparkle*.95+ring*.16;
 }else{
  // Warm gold with broad rainbow sheets and a diamond-cut lattice.
  float sheet=.5+.5*sin((uv.x-uv.y)*15.+dot(tilt,vec2(12.,8.)));
  foilColor=mix(vec3(.38,.22,.045),vec3(.85,.65,.27),sheet);
  foilColor=mix(foilColor,rainbow*.60+.12,.35);
  vec2 diamond=vec2(uv.x+uv.y,uv.x-uv.y)*22.;
  float line=pow(.5+.5*cos(diamond.x*6.283185),32.)+pow(.5+.5*cos(diamond.y*6.283185),32.);
  glint=line*.12*pow(.5+.5*sin(spectral*6.283185+tilt.x*6.),4.);
 }
 // Offset rows of the actual DORKS hand mark, revealed by one directional light window.
 vec2 stampGrid=uv*dorksFoilGrid;
 stampGrid.x+=mod(floor(stampGrid.y),2.)*.5;
 vec2 stampUv=(fract(stampGrid)-.5)/vec2(.56,.84*dorksFoilGrid.y/dorksFoilGrid.x)+.5;
 float inside=step(0.,stampUv.x)*step(stampUv.x,1.)*step(0.,stampUv.y)*step(stampUv.y,1.);
 float stamp=texture2D(dorksFoilStamp,clamp(stampUv,0.,1.)).a*inside;
 float reveal=smoothstep(.10,.83,sin(dot(tilt,vec2(7.,-5.))-.60))*smoothstep(.045,.22,length(tilt));
 float opposite=smoothstep(.5,.97,sin(dot(tilt,vec2(-6.,4.))-.35))*smoothstep(.06,.25,length(tilt));
 vec3 stampColor=mix(vec3(.97,.91,.65),rainbow*.65+.35,.55);
 if(dorksFoilMode>1.5)stampColor=mix(vec3(.35,.16,.035),rainbow*.35+.10,.45);
 if(dorksFoilMode<.5)stampColor=mix(vec3(.23,.36,.40),rainbow*.35+.14,.35);
 foilColor=mix(foilColor,stampColor,stamp*reveal*.70);
 foilColor*=1.-stamp*opposite*.23;
 float sheen=pow(max(0.,1.-abs(uv.x*.75+uv.y*.25-.5+dot(tilt,vec2(.65,.3)))*3.),10.);
 foilColor+=vec3(glint)+vec3(.16,.14,.12)*sheen*(.4+.6*(1.-incidence));
 diffuseColor.rgb=mix(diffuseColor.rgb,foilColor,backgroundMask*.94);
`;
