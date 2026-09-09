let database;
export function openStorage(){
  if(database)return database;
  database=new Promise((resolve,reject)=>{
    const request=indexedDB.open('unplug-library',1);
    request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('downloads',{keyPath:'release_id'});db.createObjectStore('settings');db.createObjectStore('events',{keyPath:'id'});};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });return database;
}
async function operation(store,mode,fn){const db=await openStorage();return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode);let request;try{request=fn(tx.objectStore(store));}catch(error){reject(error);return;}tx.oncomplete=()=>resolve(request?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error || new Error('Storage transaction aborted.'));});}
export const listDownloads=()=>operation('downloads','readonly',s=>s.getAll());
export const getDownload=id=>operation('downloads','readonly',s=>s.get(id));
export const putDownload=item=>operation('downloads','readwrite',s=>s.put(item));
export const deleteDownload=id=>operation('downloads','readwrite',s=>s.delete(id));
export const setting=key=>operation('settings','readonly',s=>s.get(key));
export const saveSetting=(key,value)=>operation('settings','readwrite',s=>s.put(value,key));
export const queueEvent=event=>operation('events','readwrite',s=>s.put(event));
export const listEvents=()=>operation('events','readonly',s=>s.getAll());
export const removeEvent=id=>operation('events','readwrite',s=>s.delete(id));
export async function verifyArtifact(artifact,key){
  if(typeof artifact.html!=='string' || new TextEncoder().encode(artifact.html).length>256*1024)throw new Error('Game exceeds the supported size.');
  const bytes=new TextEncoder().encode(artifact.html);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==artifact.sha256)throw new Error('Game integrity check failed. Download it again.');
  const publicKey=await crypto.subtle.importKey('jwk',key,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  const signature=Uint8Array.from(atob(artifact.signature),c=>c.charCodeAt(0));
  if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,signature,bytes))throw new Error('Release signature is invalid.');
}
