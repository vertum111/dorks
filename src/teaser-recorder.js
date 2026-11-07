// Records the actual browser tab, including the timing meter, callouts and result.
export function mountTeaserRecorder({start,throwCap,getState,prepare,finish}){
 if(!new URLSearchParams(location.search).has('record-teaser'))return null;
 let recording=false,stopping=false,recorder,stream,chunks=[],winnerSince=0,lastAuto=0;
 const button=document.createElement('button');button.textContent='Record full winning round';button.id='record-teaser';button.className='paper-button';Object.assign(button.style,{position:'fixed',top:'12px',left:'38%',zIndex:100});document.body.append(button);
 function stop(){if(stopping||!recording)return;stopping=true;recorder.stop();}
 button.onclick=async()=>{
  try{
   await prepare();
   stream=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'browser',frameRate:30},audio:true,preferCurrentTab:true,selfBrowserSurface:'include',surfaceSwitching:'exclude'});
   const type=['video/webm;codecs=vp9','video/webm;codecs=vp8'].find(t=>MediaRecorder.isTypeSupported(t));chunks=[];recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:10000000});
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=()=>{recording=false;finish();stream.getTracks().forEach(t=>t.stop());button.hidden=false;button.textContent='Record full winning round';const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(chunks,{type}));a.download='dorks-full-round-win.webm';a.textContent='Download full round';a.id='download-teaser';a.className='paper-button';Object.assign(a.style,{position:'fixed',top:'70px',left:'38%',zIndex:100});document.body.append(a);};
   button.hidden=true;stopping=false;winnerSince=0;lastAuto=performance.now();recording=true;start();recorder.start(250);setTimeout(stop,25000);
  }catch(error){finish();button.textContent='Recording failed: '+error.message;button.disabled=false;}
 };
 return {frame(){if(!recording||stopping)return;const s=getState(),now=performance.now();if(s.phase==='finished'){if(!winnerSince)winnerSince=now;if(now-winnerSince>6500)stop();return;}if(!s.busy&&!s.charging&&s.player===0&&['duel','pair'].includes(s.phase)&&now-lastAuto>2000){lastAuto=now;throwCap();}},get active(){return recording;}};
}
