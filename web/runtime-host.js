// Only this fixed, trusted host runs in the application origin. Game code runs in
// its own opaque-origin sandbox, never in this host or an account page.
let game=null,objectUrl=null,initialized=false;
const applicationOrigin=location.origin;
window.addEventListener('message',event=>{
  if(event.source===parent&&event.origin===applicationOrigin&&event.data?.type==='unplug:load'&&!initialized){
    if(typeof event.data.html!=='string'||new TextEncoder().encode(event.data.html).length>256*1024)return;
    initialized=true;
    game=document.createElement('iframe');game.title='Sandboxed game';game.sandbox='allow-scripts';game.referrerPolicy='no-referrer';
    const parsed=new DOMParser().parseFromString(event.data.html,'text/html');
    const csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    const meta=document.createElement('meta');meta.httpEquiv='Content-Security-Policy';meta.content=csp;parsed.head.prepend(meta);
    const errors=document.createElement('script');errors.textContent="window.addEventListener('error',()=>parent.postMessage({type:'unplug:error'},'*'));window.addEventListener('unhandledrejection',()=>parent.postMessage({type:'unplug:error'},'*'));";meta.after(errors);
    objectUrl=URL.createObjectURL(new Blob(['<!doctype html>'+parsed.documentElement.outerHTML],{type:'text/html'}));game.src=objectUrl;document.body.append(game);
  }else if(game&&event.source===game.contentWindow&&['unplug:ready','unplug:error'].includes(event.data?.type)){
    parent.postMessage({type:event.data.type},applicationOrigin);
  }
});
window.addEventListener('pagehide',()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);});
parent.postMessage({type:'unplug:host-ready'},applicationOrigin);
