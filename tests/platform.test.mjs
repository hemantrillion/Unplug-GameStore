import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPublicKey, verify } from 'node:crypto';
import { createApp } from '../services/app.mjs';
import { totp } from '../services/totp.mjs';
const good='<!doctype html><html><head><title>Test game</title></head><body><script>parent.postMessage({type:"unplug:ready"},"*");</script></body></html>';
async function fixture(t){
  const dir=await mkdtemp(path.join(tmpdir(),'unplug-test-'));
  const ctx=await createApp({dataDir:dir,seed:false,adminEmail:'admin@test.local',adminPassword:'admin-test-password-123',allowTestHost:true,disableLimits:true});
  const server=ctx.app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));ctx.close();await rm(dir,{recursive:true,force:true});});
  function client(){let cookie='',csrf='';return {async request(url,payload,overrides={}){
    const response=await fetch(base+url,{method:payload===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:3000',Cookie:cookie,'X-CSRF-Token':csrf,...overrides},body:payload===undefined?undefined:JSON.stringify(payload)});
    if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
    const body=await response.json();if(body.csrf)csrf=body.csrf;return {status:response.status,body};
  }};}
  const admin=client();assert.equal((await admin.request('/api/login',{email:'admin@test.local',password:'admin-test-password-123'})).status,200);
  async function developer(name){const c=client();const r=await c.request('/api/register',{name,email:`${name}@test.local`,password:'developer-test-password-123',role:'developer'});assert.equal(r.status,201);const mail=await readFile(path.join(dir,'mail',`${r.body.user.id}-verify.txt`),'utf8');const value=mail.match(/#verify=([a-f0-9]+)/)[1];assert.equal((await c.request('/api/account/verify',{token:value})).status,200);return c;}
  return {...ctx,dir,client,admin,developer};
}
test('full review, exact-artifact approval, activation, rollback and tenant isolation',async t=>{
  const f=await fixture(t),a=await f.developer('alice'),b=await f.developer('bob');
  const first=await a.request('/api/submissions',{title:'Test game',description:'A complete test game.',version:'1.0.0',html:good});assert.equal(first.status,201);
  const id=first.body.id;
  assert.equal((await b.request('/api/dashboard')).body.releases.length,0);
  assert.equal((await b.request('/api/preview',{releaseId:id})).status,404);
  assert.equal((await b.request('/api/submissions',{gameId:first.body.gameId,title:'Stolen game',description:'An unauthorized update.',version:'1.0.1',html:good})).status,404);
  assert.equal((await a.request('/api/review',{releaseId:id})).status,403);
  assert.equal((await f.admin.request('/api/activate',{releaseId:id,sha256:first.body.sha256,expectedRevision:0,reason:'Before approval'})).status,409);
  const decision={releaseId:id,sha256:first.body.sha256,decision:'approved',feedback:'Play-tested and reviewed.',checklist:{playable:true,content:true,controls:true}};
  assert.equal((await f.admin.request('/api/review',decision)).status,409);
  assert.equal((await f.admin.request('/api/preview',{releaseId:id})).status,200);
  assert.equal((await f.admin.request('/api/review',decision)).status,200);
  assert.equal((await f.admin.request('/api/activate',{releaseId:id,sha256:'wrong',expectedRevision:0,reason:'Wrong digest'})).status,409);
  assert.equal((await f.admin.request('/api/activate',{releaseId:id,sha256:first.body.sha256,expectedRevision:0,reason:'First release'})).body.revision,1);
  const artifact=(await a.request(`/api/artifacts/${id}`)).body;
  const key=(await a.request('/api/config')).body.publicKey;
  assert.ok(verify('sha256',Buffer.from(artifact.html),{key:createPublicKey({key,format:'jwk'}),dsaEncoding:'ieee-p1363'},Buffer.from(artifact.signature,'base64')));
  assert.throws(()=>f.db.prepare('UPDATE releases SET html=? WHERE id=?').run('changed',id),/immutable/);
  const second=await a.request('/api/submissions',{gameId:first.body.gameId,title:'Test game',description:'A complete test game.',version:'1.0.1',html:good.replace('Test game','Second game')});assert.equal(second.status,201);
  await f.admin.request('/api/preview',{releaseId:second.body.id});assert.equal((await f.admin.request('/api/review',{...decision,releaseId:second.body.id,sha256:second.body.sha256})).status,200);
  assert.equal((await f.admin.request('/api/activate',{releaseId:second.body.id,sha256:second.body.sha256,expectedRevision:1,reason:'Second release'})).body.revision,2);
  assert.equal((await f.admin.request('/api/activate',{releaseId:id,sha256:first.body.sha256,expectedRevision:1,reason:'Stale attempt'})).status,409);
  assert.equal((await f.admin.request('/api/activate',{releaseId:id,sha256:first.body.sha256,expectedRevision:2,reason:'Rollback to known good'})).body.revision,3);
  assert.equal((await a.request('/api/catalog')).body.games[0].version,'1.0.0');
  const report=await b.request('/api/reports',{releaseId:id,message:'The paddle movement feels slow.'});assert.equal(report.status,201);
  assert.equal((await a.request('/api/dashboard')).body.reports.length,1);
  assert.equal((await b.request(`/api/reports/${report.body.id}`,{status:'resolved',resolution:'Unauthorized reply.'})).status,404);
  assert.equal((await a.request(`/api/reports/${report.body.id}`,{status:'resolved',resolution:'Updated in a new version.'})).status,200);
});
test('CSRF, source contract, duplicate versions and private artifacts are enforced',async t=>{
  const f=await fixture(t),a=await f.developer('alice');
  const input={title:'Test game',description:'A complete test game.',version:'1.0.0',html:good};
  assert.equal((await a.request('/api/submissions',input,{'X-CSRF-Token':'wrong'})).status,403);
  assert.equal((await a.request('/api/submissions',input,{Origin:'https://attacker.invalid'})).status,403);
  for(const html of [good.replace('<script>','<script src="https://example.com/game.js">'),good.replace('<body>','<body onload="alert(1)">'),good.replace('<body>','<body><iframe></iframe>'),good.replace('<script>','<script>const = ;')])assert.equal((await a.request('/api/submissions',{...input,html})).status,400);
  const r=await a.request('/api/submissions',input);assert.equal(r.status,201);
  assert.equal((await a.request('/api/submissions',{...input,gameId:r.body.gameId})).status,409);
  assert.equal((await f.client().request(`/api/artifacts/${r.body.id}`)).status,404);
});
test('password reset is one-use and revokes existing sessions',async t=>{
  const f=await fixture(t),a=await f.developer('alice');
  const me=(await a.request('/api/me')).body.user;
  const outsider=f.client();await outsider.request('/api/account/forgot',{email:me.email});
  const mail=await readFile(path.join(f.dir,'mail',`${me.id}-reset.txt`),'utf8');const value=mail.match(/#reset=([a-f0-9]+)/)[1];
  assert.equal((await outsider.request('/api/account/reset',{token:value,password:'replacement-password-456'})).status,200);
  assert.equal((await a.request('/api/dashboard')).status,401);
  assert.equal((await outsider.request('/api/account/reset',{token:value,password:'another-password-456'})).status,400);
  assert.equal((await outsider.request('/api/login',{email:me.email,password:'replacement-password-456'})).status,200);
});
test('online matchmaking validates turns, prevents replay and derives leaderboard wins',async t=>{
  const f=await fixture(t),a=await f.developer('alice'),b=await f.developer('bob'),stranger=await f.developer('carol');
  const waiting=(await a.request('/api/online/join',{})).body.match;
  const joined=(await b.request('/api/online/join',{})).body.match;assert.equal(waiting.id,joined.id);
  assert.equal((await b.request('/api/online/move',{matchId:joined.id,revision:0,cell:3})).status,400);
  assert.equal((await stranger.request('/api/online/move',{matchId:joined.id,revision:0,cell:0})).status,404);
  for(const [revision,cell,c] of [[0,0,a],[1,3,b],[2,1,a],[3,4,b],[4,2,a]])assert.equal((await c.request('/api/online/move',{matchId:joined.id,revision,cell})).status,200);
  assert.equal((await a.request('/api/online/move',{matchId:joined.id,revision:4,cell:2})).status,409);
  assert.deepEqual((await a.request('/api/online/leaderboard')).body.scores,[{name:'alice',wins:1}]);
});

test('MFA is confirmed before enabling, enforced on login, and protected from concurrent replay',async t=>{
  const f=await fixture(t),a=await f.developer('alice');
  const setup=await a.request('/api/account/mfa/setup',{password:'developer-test-password-123'});assert.equal(setup.status,200);
  assert.equal((await a.request('/api/me')).body.user.mfaEnabled,false);
  const code=totp(setup.body.secret);
  assert.equal((await a.request('/api/account/mfa/confirm',{otp:code})).status,200);
  assert.equal((await a.request('/api/me')).body.user.mfaEnabled,true);
  const credentials={email:'alice@test.local',password:'developer-test-password-123'};
  assert.equal((await f.client().request('/api/login',credentials)).status,401);
  assert.equal((await f.client().request('/api/login',{...credentials,otp:code})).status,401);
  const futureCode=totp(setup.body.secret,Math.floor(Date.now()/30000)+1);
  const results=await Promise.all([f.client(),f.client()].map(c=>c.request('/api/login',{...credentials,otp:futureCode})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,401]);
});
