import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudioDesign} from '../src/audio.js';

test('game events start audio without visiting settings, survive interrupted context, and respect mute',async()=>{
 const started=[],contexts=[],elements=new Map();
 const param=()=>({value:0,setTargetAtTime(){},setValueAtTime(){},exponentialRampToValueAtTime(){}});
 function node(){return {gain:param(),frequency:param(),connect(){return this;},disconnect(){},start(){started.push(this.buffer||'tone');},stop(){}};}
 class Context {
  constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=64;this.destination=node();this.resumes=0;contexts.push(this);}
  createGain(){return node();}createBiquadFilter(){return node();}createOscillator(){return node();}createBufferSource(){return {...node(),playbackRate:param()};}
  createDynamicsCompressor(){return {...node(),threshold:param(),ratio:param()};}
  createBuffer(){return {noise:true,getChannelData:()=>new Float32Array(64)};}
  async decodeAudioData(bytes){return {meme:true,name:bytes.name};}async resume(){this.resumes++;this.state='running';}async suspend(){this.state='suspended';}
 }
 const element=key=>{if(!elements.has(key))elements.set(key,{value:'throw',checked:false,setAttribute(){},close(){},showModal(){}});return elements.get(key);};
 const before={window:globalThis.window,document:globalThis.document,localStorage:globalThis.localStorage,fetch:globalThis.fetch};
 globalThis.window={AudioContext:Context};globalThis.document={hidden:false,addEventListener(){},body:{append(){}},createElement:()=>({setAttribute(){},querySelector:element}),querySelector:element};
 globalThis.localStorage={getItem:()=>null,setItem(){}};globalThis.fetch=async url=>({ok:true,arrayBuffer:async()=>{const buffer=new ArrayBuffer(8);buffer.name=url;return buffer;}});
 try {
  const audio=createAudioDesign();audio.play('throw');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(contexts.length,1);assert.equal(contexts[0].state,'running');assert.ok(started.some(buffer=>buffer.meme),'the actual throw event plays a decoded reaction after first load');
  contexts[0].state='interrupted';const count=started.filter(buffer=>buffer.meme).length;audio.play('win');
  assert.equal(contexts[0].state,'running');assert.ok(contexts[0].resumes>=2);assert.equal(started.filter(buffer=>buffer.meme).length,count+1,'outcome plays its own reaction');
  element('#audio-muted').checked=true;element('#audio-muted').onchange();const mutedCount=started.length;audio.play('lose');assert.equal(started.length,mutedCount);
  await audio.prepareRecording();audio.play('throw');assert.match(started.findLast(buffer=>buffer.meme).name,/\/poke\.mp3$/);audio.play('win');assert.match(started.findLast(buffer=>buffer.meme).name,/\/yeah-buddy\.mp3$/);audio.finishRecording();const restored=started.length;audio.play('lose');assert.equal(started.length,restored,'recording restores the previous mute setting');
 } finally {for(const [key,value] of Object.entries(before)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
