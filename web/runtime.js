import { verifyArtifact, queueEvent, listEvents, removeEvent } from './storage.js';
const dialog=document.querySelector('#player-dialog'),container=document.querySelector('#runtime'),status=document.querySelector('#player-status');
let cleanup=()=>{};
export function closeGame(){cleanup();cleanup=()=>{};container.replaceChildren();if(dialog.open)dialog.close();}
document.querySelector('#player-close').addEventListener('click',closeGame);
dialog.addEventListener('cancel',()=>closeGame());
export async function flushTelemetry(){
  try{const events=(await listEvents()).slice(0,20);if(!events.length)return;const response=await fetch('/api/telemetry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events}),signal:AbortSignal.timeout(6000)});if(response.ok)await Promise.all(events.map(e=>removeEvent(e.id)));}catch{/* Durable queue retries on reconnect. */}
}
export async function playGame(game,artifact,key,preview=false){
  await verifyArtifact(artifact,key);closeGame();
  const frame=document.createElement('iframe');frame.title=game.title;frame.referrerPolicy='no-referrer';
  let ready=false,failed=false;
  async function report(event){if(preview)return;const events=await listEvents();if(events.length>=200)await removeEvent(events[0].id);await queueEvent({id:crypto.randomUUID(),releaseId:game.release_id || game.id,event});await flushTelemetry();}
  function message(event){
    if(event.source!==frame.contentWindow || !event.data || typeof event.data!=='object')return;
    if(event.origin!==location.origin)return;
    if(event.data.type==='unplug:host-ready'){frame.contentWindow.postMessage({type:'unplug:load',html:artifact.html},location.origin);return;}
    if(event.data.type==='unplug:ready' && !ready && !failed){ready=true;clearTimeout(timer);status.textContent=preview?'Preview running · complete the review after play-testing':'Running · verified local release';void report('ready').catch(()=>{});}
    if(event.data.type==='unplug:error' && !failed){failed=true;clearTimeout(timer);status.textContent='Game reported an error. Close it and try a known-good release.';void report('runtime_error').catch(()=>{});}
  }
  const timer=setTimeout(()=>{if(!ready&&!failed){failed=true;status.textContent='Startup timed out. Try a previous downloaded release.';void report('load_failed').catch(()=>{});}},8000);
  window.addEventListener('message',message);
  cleanup=()=>{clearTimeout(timer);window.removeEventListener('message',message);frame.remove();};
  document.querySelector('#player-title').textContent=`${game.title} · ${game.version}`;
  status.textContent='Verifying startup…';frame.src='/runtime-host.html';container.append(frame);dialog.showModal();
}
