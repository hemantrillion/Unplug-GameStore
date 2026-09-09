import express from 'express';
import { rateLimit } from 'express-rate-limit';
import nodemailer from 'nodemailer';
import { randomUUID, generateKeyPairSync, sign, createPublicKey } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './database.mjs';
import { token, digest, passwordHash, passwordMatches, fail, text, email, password, transaction } from './security.mjs';
import { validateGame } from './contracts.mjs';
import { onlineRoutes } from './online.mjs';
import { newTotpSecret, verifyTotp } from './totp.mjs';
import { rebuildAndDeploy, getPackagerStatus } from './packager.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export async function createApp(options={}) {
  const production=options.production ?? process.env.NODE_ENV==='production';
  const origin=options.origin || process.env.PUBLIC_ORIGIN || 'http://127.0.0.1:3000';
  const dataDir=path.resolve(options.dataDir || process.env.DATA_DIR || '.local-data');
  const enablePackager=options.packager ?? !options.allowTestHost;
  if (production && (!origin.startsWith('https://') || !process.env.SMTP_URL || !process.env.MAIL_FROM)) throw new Error('Production requires PUBLIC_ORIGIN HTTPS, SMTP_URL and MAIL_FROM.');
  await mkdir(dataDir,{recursive:true});
  await mkdir(path.join(dataDir,'mail'),{recursive:true});
  let privateKey;
  try { privateKey=await readFile(path.join(dataDir,'release-key.pem'),'utf8'); }
  catch(error) {
    if(error.code!=='ENOENT') throw error;
    const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
    privateKey=pair.privateKey.export({type:'pkcs8',format:'pem'});
    await writeFile(path.join(dataDir,'release-key.pem'),privateKey,{flag:'wx',mode:0o600});
  }
  const publicKey=createPublicKey(privateKey).export({format:'jwk'});
  const signHtml=html=>sign('sha256',Buffer.from(html),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64');
  const db=openDatabase(path.join(dataDir,'unplug.sqlite'));
  const one=(sql,...args)=>db.prepare(sql).get(...args);
  const all=(sql,...args)=>db.prepare(sql).all(...args);
  const run=(sql,...args)=>db.prepare(sql).run(...args);
  const audit=(actor,action,target,detail='')=>run('INSERT INTO audit VALUES(?,?,?,?,?,?)',randomUUID(),actor,action,target,detail,Date.now());
  const notify=(id,message)=>run('INSERT INTO notifications VALUES(?,?,?,?)',randomUUID(),id,message,Date.now());
  const safeUser=u=>({id:u.id,name:u.name,email:u.email,role:u.role,verified:!!u.verified,mfaEnabled:!!u.mfa_secret});
  const adminEmail=options.adminEmail || process.env.ADMIN_EMAIL || 'admin@unplug.local';
  let admin=one('SELECT * FROM users WHERE email=?',adminEmail);
  if(!admin) {
    const initialPassword=options.adminPassword || process.env.ADMIN_PASSWORD || token();
    password(initialPassword);
    const hash=await passwordHash(initialPassword);
    const id=randomUUID();
    run('INSERT INTO users(id,email,name,password_hash,role,verified,created) VALUES(?,?,?,?,?,?,?)',id,email(adminEmail),'Platform administrator',hash,'admin',1,Date.now());
    await writeFile(path.join(dataDir,'first-login.txt'),`UNPLUG administrator\nEmail: ${adminEmail}\nPassword: ${initialPassword}\nChange this password in Account after signing in.\n`,{mode:0o600});
    admin=one('SELECT * FROM users WHERE id=?',id);
  }
  const dummyHash=await passwordHash(token());
  if(options.seed!==false) {
    for(const [id,title,description,color] of [
      ['bounce','Bounce','Find your rhythm. Keep the ball in play with your paddle.','#e89139'],
      ['memory','Memory Garden','Slow down and find the matching pairs in a colorful garden.','#6f9b74'],
      ['snake','Neon Trail','Collect sparks, grow your trail, and keep moving.','#9271cf']
    ]) {
      if(one('SELECT id FROM games WHERE id=?',id))continue;
      const html=await readFile(path.join(root,'games',`${id}.html`),'utf8');
      const checked=validateGame('1.0.0',html), releaseId=randomUUID();
      transaction(db,()=>{
        run('INSERT INTO games(id,owner_id,title,description,category,color) VALUES(?,?,?,?,?,?)',id,admin.id,title,description,'first-party',color);
        run('INSERT INTO releases(id,game_id,version,html,sha256,signature,bytes,checks,state,created) VALUES(?,?,?,?,?,?,?,?,?,?)',releaseId,id,'1.0.0',html,checked.sha256,signHtml(html),checked.bytes,JSON.stringify(checked.checks),'candidate',Date.now());
        audit(admin.id,'release.seeded',releaseId,'First-party candidate awaiting actual review');
      });
    }
  }
  const app=express();
  app.disable('x-powered-by');
  if(production) app.set('trust proxy','loopback');
  app.use((req,res,next)=>{
    if(req.headers.host!==new URL(origin).host && !options.allowTestHost) return res.status(400).json({error:'Unexpected request host.'});
    res.set({
      'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
      'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      'Cache-Control':'no-store'
    });
    if(req.path==='/runtime-host.html')res.set('Content-Security-Policy',"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src data:; media-src data:; connect-src 'none'; frame-src blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'");
    if(production) res.set('Strict-Transport-Security','max-age=31536000');
    next();
  });
  app.use(express.json({limit:'350kb',strict:true}));
  app.use('/api',(req,res,next)=>{
    if(req.method==='POST' && (!req.is('application/json') || !req.body || typeof req.body!=='object' || Array.isArray(req.body)))return res.status(400).json({error:'A JSON object is required.'});
    next();
  });
  const limiter=(limit,windowMs)=>rateLimit({windowMs,limit,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many requests. Please wait and try again.'},skip:()=>options.disableLimits===true});
  const authLimit=limiter(20,15*60*1000), mutationLimit=limiter(100,60*1000);
  const cookieName=production?'__Host-unplug_session':'unplug_session';
  function getSession(req) {
    const value=(req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(`${cookieName}=`))?.slice(cookieName.length+1);
    if(!value || !/^[a-f0-9]{64}$/.test(value)) return null;
    return one('SELECT u.*,s.csrf,s.token_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>? AND u.suspended=0',digest(value),Date.now());
  }
  function user(roles) { return (req,res,next)=>{ req.user=getSession(req); if(!req.user) return next(Object.assign(new Error('Please sign in.'),{status:401})); if(roles && !roles.includes(req.user.role)) return next(Object.assign(new Error('Permission denied.'),{status:403})); if(production && roles && ['admin','reviewer'].includes(req.user.role) && !req.user.mfa_secret)return next(Object.assign(new Error('Enable authenticator protection in Account before privileged operations.'),{status:403})); next(); }; }
  function sameOrigin(req,res,next) { if(req.get('origin')!==origin) return next(Object.assign(new Error('Request origin is not allowed.'),{status:403})); next(); }
  function write(req,res,next) { sameOrigin(req,res,error=>{if(error)return next(error);if(req.get('x-csrf-token')!==req.user.csrf) return next(Object.assign(new Error('Refresh your session and try again.'),{status:403})); next();}); }
  function session(req,res,u) {
    const old=getSession(req); if(old) run('DELETE FROM sessions WHERE token_hash=?',old.token_hash);
    const value=token(),csrf=token();
    run('INSERT INTO sessions VALUES(?,?,?,?)',digest(value),u.id,csrf,Date.now()+8*60*60*1000);
    res.cookie(cookieName,value,{httpOnly:true,secure:production,sameSite:'strict',path:'/',maxAge:8*60*60*1000});
    return {user:safeUser(u),csrf};
  }
  const smtp=process.env.SMTP_URL?nodemailer.createTransport(process.env.SMTP_URL):null;
  async function sendAccountMail(u,kind) {
    const value=token();
    run('DELETE FROM account_tokens WHERE user_id=? AND kind=?',u.id,kind);
    run('INSERT INTO account_tokens VALUES(?,?,?,?)',digest(value),u.id,kind,Date.now()+60*60*1000);
    const url=`${origin}/#${kind}=${value}`;
    const message={from:process.env.MAIL_FROM,to:u.email,subject:`UNPLUG ${kind==='verify'?'email verification':'password reset'}`,text:`Open this link within one hour:\n${url}\nIf you did not request this, ignore it.`};
    if(smtp) await smtp.sendMail(message);
    else await writeFile(path.join(dataDir,'mail',`${u.id}-${kind}.txt`),`${message.to}\n${message.subject}\n${message.text}`,{mode:0o600});
  }
  function release(id) { const r=one('SELECT r.*,g.owner_id,g.title,g.disabled,g.active_release FROM releases r JOIN games g ON g.id=r.game_id WHERE r.id=?',String(id)); if(!r) fail(404,'Release not found.'); return r; }
  const owns=(u,r)=>u.role==='admin' || r.owner_id===u.id;
  const canReview=u=>['admin','reviewer'].includes(u.role);
  const verified=u=>{if(!u.verified) fail(403,'Verify your email before submitting games.');};

  app.get('/api/health',(req,res)=>{one('SELECT 1');res.json({status:'ok',service:'unplug',version:'0.1.0'});});
  app.get('/api/config',(req,res)=>res.json({production,publicKey,registration:!production || process.env.ALLOW_REGISTRATION==='true',mailMode:smtp?'smtp':'local',contract:{version:1,maxBytes:256*1024},features:{ads:false,payments:false,payouts:false}}));
  app.get('/api/me',(req,res)=>{const u=getSession(req);res.json(u?{user:safeUser(u),csrf:u.csrf}:{user:null,csrf:null});});
  app.post('/api/register',authLimit,sameOrigin,async(req,res)=>{
    if(production && process.env.ALLOW_REGISTRATION!=='true') fail(403,'Registration is currently closed.');
    const address=email(req.body.email),name=text(req.body.name,'Name',2,60),pass=password(req.body.password);
    if(!['player','developer'].includes(req.body.role)) fail(400,'Choose player or developer.');
    if(one('SELECT id FROM users WHERE email=?',address)) fail(409,'Unable to create this account. Try signing in or recovering your password.');
    const hash=await passwordHash(pass),id=randomUUID();
    try { run('INSERT INTO users(id,email,name,password_hash,role,created) VALUES(?,?,?,?,?,?)',id,address,name,hash,req.body.role,Date.now()); }
    catch(error){if(error.code?.startsWith('ERR_SQLITE')) fail(409,'Unable to create this account.');throw error;}
    const u=one('SELECT * FROM users WHERE id=?',id);
    audit(id,'account.created',id);
    let mailSent=true;
    try { await sendAccountMail(u,'verify'); } catch { mailSent=false; }
    res.status(201).json({...session(req,res,u),mailSent});
  });
  app.post('/api/login',authLimit,sameOrigin,async(req,res)=>{
    const address=email(req.body.email),pass=typeof req.body.password==='string'?req.body.password:'';
    if(pass.length>128) fail(401,'Invalid email or password.');
    let u=one('SELECT * FROM users WHERE email=?',address);
    const valid=await passwordMatches(pass,u?.password_hash || dummyHash);
    if(!u || !valid || u.suspended) fail(401,'Invalid email or password.');
    const authenticatedHash=u.password_hash;
    u=one('SELECT * FROM users WHERE id=?',u.id);
    if(!u || u.suspended || u.password_hash!==authenticatedHash)fail(401,'Account changed. Please sign in again.');
    if(u.mfa_secret){
      const step=verifyTotp(u.mfa_secret,req.body.otp,u.mfa_last_step);
      if(step===null)fail(401,'Enter a current, unused authenticator code.');
      run('UPDATE users SET mfa_last_step=? WHERE id=?',step,u.id);
    }
    audit(u.id,'account.login',u.id);res.json(session(req,res,u));
  });
  app.post('/api/logout',user(),write,(req,res)=>{run('DELETE FROM sessions WHERE token_hash=?',req.user.token_hash);res.clearCookie(cookieName,{httpOnly:true,secure:production,sameSite:'strict',path:'/'});res.json({ok:true});});
  app.post('/api/account/resend',authLimit,user(),write,async(req,res)=>{if(!req.user.verified) await sendAccountMail(req.user,'verify');res.json({ok:true});});
  app.post('/api/account/verify',authLimit,sameOrigin,(req,res)=>{
    const t=one("SELECT * FROM account_tokens WHERE token_hash=? AND kind='verify' AND expires>?",digest(String(req.body.token)),Date.now());
    if(!t) fail(400,'This verification link is invalid or expired.');
    transaction(db,()=>{run('UPDATE users SET verified=1 WHERE id=?',t.user_id);run('DELETE FROM account_tokens WHERE token_hash=?',t.token_hash);});res.json({ok:true});
  });
  app.post('/api/account/forgot',authLimit,sameOrigin,async(req,res)=>{
    const address=email(req.body.email),u=one('SELECT * FROM users WHERE email=? AND suspended=0',address);
    if(u) { try {await sendAccountMail(u,'reset');} catch { /* Keep recovery responses non-enumerating. */ } }
    res.json({ok:true,message:'If an account exists, recovery instructions have been sent.'});
  });
  app.post('/api/account/reset',authLimit,sameOrigin,async(req,res)=>{
    const hash=await passwordHash(password(req.body.password));
    transaction(db,()=>{
      const t=one("SELECT * FROM account_tokens WHERE token_hash=? AND kind='reset' AND expires>?",digest(String(req.body.token)),Date.now());
      if(!t) fail(400,'This recovery link is invalid or expired.');
      run('UPDATE users SET password_hash=? WHERE id=?',hash,t.user_id);run('DELETE FROM sessions WHERE user_id=?',t.user_id);run('DELETE FROM account_tokens WHERE user_id=?',t.user_id);audit(t.user_id,'account.password_reset',t.user_id);
    });res.json({ok:true});
  });
  app.post('/api/account/password',authLimit,user(),write,async(req,res)=>{
    if(typeof req.body.currentPassword!=='string' || req.body.currentPassword.length>128 || !await passwordMatches(req.body.currentPassword,req.user.password_hash)) fail(400,'Current password is incorrect.');
    const hash=await passwordHash(password(req.body.password));
    run('UPDATE users SET password_hash=? WHERE id=?',hash,req.user.id);run('DELETE FROM sessions WHERE user_id=?',req.user.id);audit(req.user.id,'account.password_changed',req.user.id);res.json(session(req,res,req.user));
  });
  app.post('/api/account/revoke',user(),write,(req,res)=>{run('DELETE FROM sessions WHERE user_id=? AND token_hash<>?',req.user.id,req.user.token_hash);res.json({ok:true});});
  app.post('/api/account/mfa/setup',authLimit,user(),write,async(req,res)=>{
    if(req.user.mfa_secret)fail(409,'Authenticator protection is already enabled.');
    if(typeof req.body.password!=='string'||req.body.password.length>128||!await passwordMatches(req.body.password,req.user.password_hash))fail(400,'Password is incorrect.');
    const secret=newTotpSecret();run('UPDATE users SET mfa_pending=? WHERE id=?',secret,req.user.id);
    res.json({secret,uri:`otpauth://totp/UNPLUG:${encodeURIComponent(req.user.email)}?secret=${secret}&issuer=UNPLUG&algorithm=SHA1&digits=6&period=30`});
  });
  app.post('/api/account/mfa/confirm',authLimit,user(),write,(req,res)=>{
    const step=req.user.mfa_pending?verifyTotp(req.user.mfa_pending,req.body.otp):null;
    if(step===null)fail(400,'Enter the current code from the configured authenticator.');
    transaction(db,()=>{run('UPDATE users SET mfa_secret=mfa_pending,mfa_pending=NULL,mfa_last_step=? WHERE id=?',step,req.user.id);run('DELETE FROM sessions WHERE user_id=? AND token_hash<>?',req.user.id,req.user.token_hash);audit(req.user.id,'account.mfa_enabled',req.user.id);});res.json({ok:true});
  });
  app.get('/api/account/export',user(),(req,res)=>res.json({user:safeUser(req.user),reports:all('SELECT * FROM reports WHERE user_id=?',req.user.id),games:all('SELECT id,title,description FROM games WHERE owner_id=?',req.user.id),notifications:all('SELECT message,created FROM notifications WHERE user_id=?',req.user.id)}));
  app.post('/api/account/delete',authLimit,user(),write,async(req,res)=>{
    if(req.user.role==='admin') fail(409,'Transfer administrator responsibility before deleting this account.');
    if(typeof req.body.password!=='string' || req.body.password.length>128 || !await passwordMatches(req.body.password,req.user.password_hash)) fail(400,'Password is incorrect.');
    const hash=await passwordHash(token());
    transaction(db,()=>{
      run('UPDATE users SET email=?,name=?,password_hash=?,suspended=1 WHERE id=?',`${req.user.id}@deleted.invalid`,'Deleted account',hash,req.user.id);
      run('UPDATE games SET disabled=1,revision=revision+1 WHERE owner_id=?',req.user.id);
      run('DELETE FROM sessions WHERE user_id=?',req.user.id);run('DELETE FROM account_tokens WHERE user_id=?',req.user.id);run('DELETE FROM notifications WHERE user_id=?',req.user.id);
      audit(req.user.id,'account.deleted',req.user.id,'Release and audit records retained; profile anonymized');
    });res.clearCookie(cookieName,{path:'/'});res.json({ok:true});
  });
  app.get('/api/catalog',(req,res)=>res.json({games:all("SELECT g.id,g.title,g.description,g.category,g.color,g.revision,r.id AS release_id,r.version,r.sha256,r.signature,r.bytes FROM games g JOIN releases r ON r.id=g.active_release WHERE g.disabled=0 AND r.state='approved' ORDER BY g.category,g.title")}));
  app.get('/api/artifacts/:id',(req,res)=>{
    const r=release(req.params.id);
    if(r.disabled || r.active_release!==r.id || r.state!=='approved') fail(404,'This release is not available for download.');
    if(digest(r.html)!==r.sha256 || r.approved_digest!==r.sha256) fail(409,'Release integrity check failed.');
    res.json({id:r.id,html:r.html,sha256:r.sha256,signature:r.signature,bytes:r.bytes});
  });
  app.get('/api/dashboard',user(['developer','reviewer','admin']),(req,res)=>{
    const broad=canReview(req.user)?1:0;
    const games=all('SELECT * FROM games WHERE ?=1 OR owner_id=?',broad,req.user.id);
    const releases=all(`SELECT r.id,r.game_id,r.version,r.sha256,r.bytes,r.checks,r.state,r.created,g.title,g.owner_id,g.active_release,
      (SELECT feedback FROM reviews WHERE release_id=r.id ORDER BY created DESC LIMIT 1) AS feedback,
      (SELECT count(*) FROM telemetry WHERE release_id=r.id AND event='ready' AND created>?) AS ready,
      (SELECT count(*) FROM telemetry WHERE release_id=r.id AND event<>'ready' AND created>?) AS failed
      FROM releases r JOIN games g ON g.id=r.game_id WHERE ?=1 OR g.owner_id=? ORDER BY r.created DESC LIMIT 200`,Date.now()-86400000,Date.now()-86400000,broad,req.user.id);
    res.json({games,releases,deployments:all('SELECT d.*,g.title,r.version FROM deployments d JOIN games g ON g.id=d.game_id JOIN releases r ON r.id=d.release_id WHERE ?=1 OR g.owner_id=? ORDER BY d.created DESC LIMIT 100',broad,req.user.id),reports:all('SELECT p.*,g.title,r.version FROM reports p JOIN releases r ON r.id=p.release_id JOIN games g ON g.id=r.game_id WHERE ?=1 OR g.owner_id=? ORDER BY p.created DESC LIMIT 100',broad,req.user.id),notifications:all('SELECT * FROM notifications WHERE user_id=? ORDER BY created DESC LIMIT 30',req.user.id)});
  });
  app.post('/api/submissions',mutationLimit,user(['developer','admin']),write,(req,res)=>{
    verified(req.user);
    const title=text(req.body.title,'Title',2,80),description=text(req.body.description,'Description',10,500);
    const checked=validateGame(req.body.version,req.body.html);
    if(all('SELECT id FROM releases WHERE game_id IN (SELECT id FROM games WHERE owner_id=?) AND created>?',req.user.id,Date.now()-86400000).length>=50) fail(429,'Daily submission quota reached.');
    let g=req.body.gameId?one('SELECT * FROM games WHERE id=?',String(req.body.gameId)):null;
    if(req.body.gameId && (!g || !owns(req.user,g))) fail(404,'Game not found.');
    if(g && one('SELECT id FROM releases WHERE game_id=? AND version=?',g.id,req.body.version)) fail(409,'That version already exists. Submit a new version.');
    const result=transaction(db,()=>{
      if(!g) {g={id:randomUUID()};run('INSERT INTO games(id,owner_id,title,description,category) VALUES(?,?,?,?,?)',g.id,req.user.id,title,description,req.user.role==='admin'?'first-party':'community');}
      const id=randomUUID();
      run('INSERT INTO releases(id,game_id,version,html,sha256,signature,bytes,checks,state,created) VALUES(?,?,?,?,?,?,?,?,?,?)',id,g.id,req.body.version,req.body.html,checked.sha256,signHtml(req.body.html),checked.bytes,JSON.stringify(checked.checks),'candidate',Date.now());
      audit(req.user.id,'release.submitted',id);return{id,gameId:g.id,sha256:checked.sha256};
    });res.status(201).json(result);
  });
  app.post('/api/ci/candidates',mutationLimit,(req,res)=>{
    const credential=req.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    const ci=credential?one('SELECT * FROM ci_tokens WHERE token_hash=? AND expires>?',digest(credential),Date.now()):null;
    if(!ci)fail(401,'A valid staging token is required.');
    if(req.body.gameId!==ci.game_id)fail(403,'This token cannot stage candidates for that game.');
    if(req.body.contractVersion!==1||typeof req.body.sourceCommit!=='string'||!/^[a-f0-9]{40}$/.test(req.body.sourceCommit))fail(400,'Contract version and exact source commit are required.');
    const checked=validateGame(req.body.version,req.body.html);
    if(checked.sha256!==req.body.sha256||checked.bytes!==req.body.bytes)fail(400,'Candidate digest or size mismatch.');
    const g=one('SELECT g.*,u.suspended FROM games g JOIN users u ON u.id=g.owner_id WHERE g.id=?',ci.game_id);
    if(g.suspended||g.disabled)fail(403,'Game or owner is disabled.');
    const existing=one('SELECT id,sha256,source_commit FROM releases WHERE game_id=? AND version=?',g.id,req.body.version);
    if(existing){if(existing.sha256===checked.sha256&&existing.source_commit===req.body.sourceCommit)return res.json({id:existing.id,unchanged:true});fail(409,'Version already exists with different bytes or provenance.');}
    const id=randomUUID();
    transaction(db,()=>{
      run('INSERT INTO releases(id,game_id,version,html,sha256,signature,bytes,checks,state,created,source_commit) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,g.id,req.body.version,req.body.html,checked.sha256,signHtml(req.body.html),checked.bytes,JSON.stringify(checked.checks),'candidate',Date.now(),req.body.sourceCommit);
      audit(`ci:${g.id}`,'release.staged_from_ci',id,req.body.sourceCommit);notify(g.owner_id,`${g.title} ${req.body.version} staged from CI and awaiting review.`);
    });res.status(201).json({id,state:'candidate',sha256:checked.sha256});
  });
  app.post('/api/preview',user(['developer','reviewer','admin']),write,(req,res)=>{
    const r=release(req.body.releaseId);
    if(!owns(req.user,r) && !canReview(req.user)) fail(404,'Release not found.');
    if(digest(r.html)!==r.sha256) fail(409,'Release integrity check failed.');
    run('INSERT INTO previews VALUES(?,?,?,?) ON CONFLICT(user_id,release_id) DO UPDATE SET digest=excluded.digest,created=excluded.created',req.user.id,r.id,r.sha256,Date.now());
    res.json({id:r.id,html:r.html,sha256:r.sha256,signature:r.signature,bytes:r.bytes});
  });
  app.post('/api/review',user(['reviewer','admin']),write,(req,res)=>{
    const r=release(req.body.releaseId),decision=req.body.decision;
    if(r.state!=='candidate') fail(409,'This candidate has already been reviewed.');
    if(req.user.role!=='admin' && req.user.id===r.owner_id) fail(403,'A separate reviewer must review your submission.');
    if(!['approved','rejected','changes_requested'].includes(decision)) fail(400,'Choose a valid review decision.');
    if(req.body.sha256!==r.sha256 || digest(r.html)!==r.sha256) fail(409,'Review artifact digest mismatch.');
    const feedback=text(req.body.feedback,'Feedback',3,2000);
    const checklist=req.body.checklist || {};
    if(decision==='approved') {
      const p=one('SELECT * FROM previews WHERE user_id=? AND release_id=?',req.user.id,r.id);
      if(!p || p.digest!==r.sha256 || p.created<Date.now()-3600000 || !['playable','content','controls'].every(k=>checklist[k]===true)) fail(409,'Preview this exact candidate and complete all review checks first.');
    }
    transaction(db,()=>{
      run('UPDATE releases SET state=?,approved_digest=? WHERE id=?',decision,decision==='approved'?r.sha256:null,r.id);
      run('INSERT INTO reviews VALUES(?,?,?,?,?,?,?,?)',randomUUID(),r.id,req.user.id,decision,feedback,r.sha256,JSON.stringify(checklist),Date.now());
      audit(req.user.id,`release.${decision}`,r.id);notify(r.owner_id,`${r.title} ${r.version}: ${decision.replaceAll('_',' ')}. ${feedback}`);
    });
    if(decision==='approved' && enablePackager) {
      rebuildAndDeploy({db,dataDir}).catch(e=>console.error('[Packager auto-deploy error]:',e));
    }
    res.json({ok:true});
  });
  app.post('/api/activate',user(['admin']),write,(req,res)=>{
    const reason=text(req.body.reason,'Reason',3,500);
    const result=transaction(db,()=>{
      const r=release(req.body.releaseId),g=one('SELECT * FROM games WHERE id=?',r.game_id);
      if(r.state!=='approved' || r.approved_digest!==r.sha256 || req.body.sha256!==r.sha256 || digest(r.html)!==r.sha256) fail(409,'Only the exact approved artifact can be activated.');
      if(req.body.expectedRevision!==g.revision) fail(409,'Deployment changed. Refresh before activating.');
      if(g.disabled) fail(409,'Re-enable this game before activating a release.');
      if(g.active_release===r.id) return {revision:g.revision,unchanged:true};
      run('UPDATE games SET active_release=?,revision=revision+1 WHERE id=?',r.id,g.id);
      run('INSERT INTO deployments VALUES(?,?,?,?,?,?,?,?)',randomUUID(),g.id,r.id,g.active_release,g.revision+1,req.user.id,reason,Date.now());
      audit(req.user.id,'release.activated',r.id,reason);notify(r.owner_id,`${r.title} ${r.version} is live. Deployment revision ${g.revision+1}.`);
      return{revision:g.revision+1};
    });
    if(enablePackager) {
      rebuildAndDeploy({db,dataDir}).catch(e=>console.error('[Packager auto-deploy error]:',e));
    }
    res.json({ok:true,...result});
  });
  app.post('/api/games/:id/availability',user(['admin']),write,(req,res)=>{
    const g=one('SELECT * FROM games WHERE id=?',req.params.id);
    if(!g) fail(404,'Game not found.');
    if(typeof req.body.disabled!=='boolean') fail(400,'Set disabled to true or false.');
    const reason=text(req.body.reason,'Reason',3,500);
    transaction(db,()=>{run('UPDATE games SET disabled=?,revision=revision+1 WHERE id=?',Number(req.body.disabled),g.id);audit(req.user.id,req.body.disabled?'game.disabled':'game.enabled',g.id,reason);});res.json({ok:true});
  });
  app.post('/api/reports',mutationLimit,user(),write,(req,res)=>{
    const r=release(req.body.releaseId);if(r.active_release!==r.id && !owns(req.user,r) && !canReview(req.user)) fail(404,'Release not found.');
    const message=text(req.body.message,'Report',5,2000),id=randomUUID();
    run('INSERT INTO reports(id,release_id,user_id,message,created) VALUES(?,?,?,?,?)',id,r.id,req.user.id,message,Date.now());notify(r.owner_id,`New issue reported for ${r.title} ${r.version}.`);res.status(201).json({id});
  });
  app.post('/api/reports/:id',user(['developer','reviewer','admin']),write,(req,res)=>{
    const report=one('SELECT * FROM reports WHERE id=?',req.params.id);if(!report) fail(404,'Report not found.');
    const r=release(report.release_id);if(!owns(req.user,r) && !canReview(req.user)) fail(404,'Report not found.');
    if(!['open','investigating','resolved'].includes(req.body.status)) fail(400,'Invalid status.');
    const resolution=text(req.body.resolution,'Response',3,1000);
    transaction(db,()=>{run('UPDATE reports SET status=?,resolution=? WHERE id=?',req.body.status,resolution,report.id);notify(report.user_id,`Your report for ${r.title}: ${req.body.status}. ${resolution}`);audit(req.user.id,'report.updated',report.id);});res.json({ok:true});
  });
  app.post('/api/telemetry',limiter(120,60000),sameOrigin,(req,res)=>{
    const events=req.body.events;
    if(!Array.isArray(events) || events.length>20) fail(400,'Send at most 20 events.');
    transaction(db,()=>{for(const e of events){
      if(!e || typeof e.id!=='string' || !/^[a-f0-9-]{36}$/.test(e.id) || !['ready','load_failed','runtime_error'].includes(e.event)) fail(400,'Invalid telemetry event.');
      const r=one("SELECT id FROM releases WHERE id=? AND state='approved'",String(e.releaseId));
      if(r) run('INSERT OR IGNORE INTO telemetry VALUES(?,?,?,?)',e.id,r.id,e.event,Date.now());
    }});res.json({ok:true});
  });
  app.get('/api/admin/users',user(['admin']),(req,res)=>res.json({users:all('SELECT id,email,name,role,verified,suspended,created FROM users ORDER BY created DESC LIMIT 200')}));
  app.post('/api/admin/users/:id',user(['admin']),write,(req,res)=>{
    if(req.params.id===req.user.id) fail(400,'You cannot suspend or demote your own account.');
    if(!['player','developer','reviewer','admin'].includes(req.body.role) || typeof req.body.suspended!=='boolean') fail(400,'Invalid account settings.');
    if(!one('SELECT id FROM users WHERE id=?',req.params.id)) fail(404,'Account not found.');
    transaction(db,()=>{run('UPDATE users SET role=?,suspended=? WHERE id=?',req.body.role,Number(req.body.suspended),req.params.id);run('DELETE FROM sessions WHERE user_id=?',req.params.id);audit(req.user.id,'account.permissions_changed',req.params.id,JSON.stringify(req.body));});res.json({ok:true});
  });
  app.get('/api/admin/audit',user(['admin']),(req,res)=>res.json({events:all('SELECT * FROM audit ORDER BY created DESC LIMIT 200')}));
  app.get('/api/packager/status',(req,res)=>res.json(getPackagerStatus()));
  app.post('/api/admin/rebuild-apk',user(['admin']),write,async(req,res)=>{
    rebuildAndDeploy({db,dataDir}).catch(e=>console.error('[Packager manual-deploy error]:',e));
    res.json({ok:true,message:'Rebuild and deployment pipeline triggered.'});
  });
  onlineRoutes(app,{db,user,write,limit:mutationLimit});
  app.use('/api',(req,res)=>res.status(404).json({error:'Endpoint not found.'}));
  app.use(express.static(path.join(root,'web'),{dotfiles:'deny',etag:true,maxAge:0,setHeaders(res,file){if(file.endsWith('sw.js'))res.setHeader('Cache-Control','no-cache');}}));
  app.use((req,res)=>res.status(404).send('Not found'));
  app.use((error,req,res,next)=>{
    if(res.headersSent) return next(error);
    const status=error.status || 500;
    if(status>=500) console.error('Request failed:',error.message);
    res.status(status).json({error:status>=500?'The server could not complete this request.':status===413?'Upload is too large.':error.message});
  });
  const cleanup=setInterval(()=>{
    run('DELETE FROM sessions WHERE expires<?',Date.now());run('DELETE FROM account_tokens WHERE expires<?',Date.now());run('DELETE FROM previews WHERE created<?',Date.now()-3600000);run('DELETE FROM telemetry WHERE created<?',Date.now()-30*86400000);
  },60000);cleanup.unref();
  return {app,db,dataDir,close(){clearInterval(cleanup);db.close();}};
}
