import { listDownloads, getDownload, putDownload, deleteDownload, setting, saveSetting, verifyArtifact } from './storage.js';
import { playGame, closeGame, flushTelemetry } from './runtime.js';
const $=selector=>document.querySelector(selector),main=$('#main');
let current={user:null,csrf:null},config=null,catalog=[],downloads=[],dashboard=null,filter='all',search='',workspaceTab='releases',renderVersion=0,onlineTimer,installPrompt,updateRequested=false;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=value=>new Date(value).toLocaleString();
const size=bytes=>`${Math.ceil(bytes/1024)} KB`;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,6000);}
async function api(url,payload){
  const options={cache:'no-store',signal:AbortSignal.timeout(12000)};
  if(payload!==undefined){options.method='POST';options.headers={'Content-Type':'application/json','X-CSRF-Token':current.csrf || ''};options.body=JSON.stringify(payload);}
  const res=await fetch(url,options);const body=await res.json();
  if(!res.ok){if(res.status===401){current={user:null,csrf:null};updateIdentity();}throw new Error(body.error || `Request failed (${res.status}).`);}return body;
}
function updateIdentity(){$('#account-button').textContent=current.user?current.user.name:'Sign in ↗';}
function connection(online){$('#connection').textContent=online?'Connected to UNPLUG':'Offline · downloads ready';}
function heading(eyebrow,title,subtitle,extra=''){return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${extra}</div>`;}
function empty(title,message,action=''){return `<div class="empty"><h3>${title}</h3><p>${message}</p>${action}</div>`;}
function button(label,action,id='',style='subtle'){return `<button class="button ${style}" data-action="${action}" data-id="${escape(id)}">${label}</button>`;}
function art(game){
  const type=['bounce','memory','snake'].includes(game.id)?game.id:'community';
  const content={bounce:'<div class="art-bounce"></div>',memory:'<div class="art-memory"><span>✿</span><span>✦</span><span>✦</span><span>✿</span></div>',snake:'<div class="art-snake">〰</div>',community:'<div class="art-community">✧</div>'}[type];
  return `<div class="game-art ${type}" aria-hidden="true"><span class="game-badge">${game.category==='first-party'?'UNPLUG ORIGINAL':'COMMUNITY'}</span>${content}</div>`;
}
function gameCard(game,downloaded=false){
  const installed=downloads.some(d=>d.release_id===game.release_id);
  return `<article class="game-card">${art(game)}<div class="game-info"><h3>${escape(game.title)}</h3><p class="game-meta">${escape(game.version)} · ${downloaded?'Saved on this device':'Offline game'}</p><p class="game-description">${escape(game.description)}</p><div class="game-bottom"><span class="game-size">${size(game.bytes)} · ${installed?'✓ Downloaded':'Free to play'}</span>${button(installed?'Play game ↗':'Download ↓',installed?'play':'download',game.release_id,installed?'':'subtle')}</div>${downloaded?`<div class="actions" style="margin-top:12px">${button('Remove','remove',game.release_id,'small subtle')}${current.user?button('Report issue','report',game.release_id,'small subtle'):''}</div>`:''}</div></article>`;
}
async function refreshData(){
  downloads=await listDownloads();$('#download-count').textContent=downloads.length;
  try{const [me,settings,live]=await Promise.all([api('/api/me'),api('/api/config'),api('/api/catalog')]);current=me;config=settings;catalog=live.games;await saveSetting('catalog',catalog);await saveSetting('config',config);connection(true);}
  catch{catalog=await setting('catalog') || [];config=await setting('config') || null;connection(false);}
  updateIdentity();
}
async function render(){
  const version=++renderVersion;clearInterval(onlineTimer);
  let view=location.hash.slice(1).split('=')[0] || 'library';
  if(['reset','verify'].includes(view)){await accountLink(view);return;}
  if(!['library','downloads','online','workspace','account'].includes(view))view='library';
  document.querySelectorAll('[data-view]').forEach(a=>a.classList.toggle('active',a.dataset.view===view));
  $('#breadcrumb').textContent={library:'Your next good break',downloads:'Your offline collection',online:'A little friendly competition',workspace:'From idea to a great release',account:'Your space, your settings'}[view];
  if(view==='library')renderLibrary();
  if(view==='downloads')renderDownloads();
  if(view==='account')renderAccount();
  if(view==='workspace')await renderWorkspace(version);
  if(view==='online')await renderOnline(version);
}
function renderLibrary(){
  const games=catalog.filter(g=>(filter==='all'||g.category===filter)&&g.title.toLowerCase().includes(search.toLowerCase()));
  main.innerHTML=heading('MAKE A LITTLE TIME FOR YOURSELF','A little room to play.','Good games. No rush. Find your next five-minute escape.')+
  `<section class="hero"><div class="hero-copy"><p class="eyebrow">LESS SCROLLING, MORE PLAYING</p><h2>Your next break,<br>beautifully unplugged.</h2><p>A growing collection of little games to take anywhere. Download once. Find your flow, even offline.</p><a class="button" href="#downloads">Your offline collection <span>↗</span></a></div><div class="hero-art" aria-hidden="true"><div class="art-orbit"></div><span class="spark">✦</span><span class="spark second">✧</span><div class="controller"><div class="dpad"></div><div class="controller-buttons"><i></i><i></i><i></i><i></i></div></div><span class="offline-pill">↗ A little joy. Wherever you are.</span></div></section>
  <div class="benefits"><div class="benefit"><span>↓</span><div><strong>Download once, play anywhere</strong><small>Your favorites stay on your device.</small></div></div><div class="benefit"><span>◇</span><div><strong>Reviewed before release</strong><small>Every published version is approved.</small></div></div><div class="benefit"><span>✧</span><div><strong>Small by design</strong><small>Little downloads. Plenty of possibility.</small></div></div></div>
  <div class="section-heading"><div><h2>Find your next favorite</h2><p>Something small. Something worth a break.</p></div><input id="search" class="search" type="search" placeholder="Search your next escape…" aria-label="Search games" value="${escape(search)}"></div>
  <div class="filters" style="margin-bottom:20px">${[['all','All games'],['first-party','UNPLUG originals'],['community','Community creations']].map(([id,label])=>`<button class="chip ${filter===id?'active':''}" data-filter="${id}">${label}</button>`).join('')}</div>
  <div class="game-grid">${games.length?games.map(g=>gameCard(g)).join(''):empty('The next good game is on its way.',catalog.length?'No games match this search.':'The first games are waiting for administrator play-testing and approval.',button('Open creator workspace','workspace'))}</div>`;
  $('#search').addEventListener('input',e=>{search=e.target.value;const position=e.target.selectionStart;renderLibrary();$('#search').focus();try{$('#search').setSelectionRange(position,position);}catch{}});
  main.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;renderLibrary();}));
}
function renderDownloads(){main.innerHTML=heading('ALWAYS A LITTLE CLOSER','Your offline collection.','Verified games, saved here for your next break.',button('Keep storage persistent','persist'))+`<div class="notice">Downloads belong to this browser or app installation. Clearing its data removes them. Old releases stay available here until you remove them; online release changes are discovered after reconnecting.</div><div class="game-grid">${downloads.length?downloads.map(g=>gameCard(g,true)).join(''):empty('Make a little space for play.','Download an approved game from Discover, then come back here — even without internet.','<a class="button" href="#library">Discover games ↗</a>')}</div>`;}
function renderAccount(){
  if(current.user){
    const u=current.user;
    main.innerHTML=heading('YOUR UNPLUG ACCOUNT',`Hello, ${escape(u.name)}.`,`${escape(u.email)} · ${escape(u.role)}`,button('Sign out','logout'))+
    `<div class="notice">Authenticator protection: ${u.mfaEnabled?'Enabled ✓':`Not enabled. ${button('Enable authenticator','mfa','','small subtle')}`}</div>`+
    (!u.verified?`<div class="notice">Verify your email to submit games. ${config?.mailMode==='local'?'Local development emails are saved in .local-data/mail/.':''} ${button('Resend verification','resend','','small subtle')}</div>`:'')+
    `<div class="account-layout"><section class="panel"><h2>Change password</h2><form id="password-form"><label>Current password<input name="currentPassword" type="password" autocomplete="current-password" required></label><label>New password<input name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></label><p class="form-error" role="alert"></p><button class="button">Update password</button></form></section><section class="panel"><h2>Your account & data</h2><p>Manage your sessions and download your account records.</p><div class="actions">${button('Sign out other sessions','revoke')}${button('Export my data','export')}${button('Delete account','delete-account','','danger')}</div><p class="fine">Deleting an account anonymizes its profile and disables its games. Release, review and audit history are retained for traceability.</p></section></div>`;
    handleForm('#password-form',async data=>{current=await api('/api/account/password',data);toast('Password updated. Other sessions were signed out.');});return;
  }
  main.innerHTML=heading('A PLACE TO PLAY AND CREATE','Welcome to UNPLUG.','Sign in to create, review, or play together.')+
  `<div class="account-layout"><section class="panel"><div class="filters" style="margin-bottom:24px"><button class="chip active" id="login-tab">Sign in</button><button class="chip" id="register-tab">Create account</button></div><form id="auth-form"><div id="register-fields" hidden><label>Your name<input name="name" autocomplete="name" minlength="2" maxlength="60"></label><label>How will you use UNPLUG?<select name="role"><option value="player">Play games</option><option value="developer">Create and publish games</option></select></label></div><label>Email address<input name="email" type="email" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" maxlength="128" required></label><p class="form-error" role="alert"></p><button class="button" id="auth-submit">Sign in ↗</button><small>Creating an account? Use at least 12 characters.</small></form><p><button class="text-button" data-action="forgot">Forgot your password?</button></p></section><div class="account-illustration"><span class="brand-mark">u</span><h2>Little games.<br>Thoughtfully shared.</h2><p>A home for players, creators, and the people who care about a great release.</p><p>Play. Build. Review. Repeat.</p></div></div>`;
  let register=false;
  const otpLabel=document.createElement('label');otpLabel.textContent='Authenticator code (if enabled)';const otpInput=document.createElement('input');otpInput.name='otp';otpInput.inputMode='numeric';otpInput.autocomplete='one-time-code';otpInput.maxLength=6;otpLabel.append(otpInput);$('#auth-submit').before(otpLabel);
  $('#register-tab').onclick=()=>{register=true;$('#register-fields').hidden=false;$('#register-fields input').required=true;$('#auth-submit').textContent='Create account ↗';$('#register-tab').classList.add('active');$('#login-tab').classList.remove('active');};
  $('#login-tab').onclick=()=>{register=false;$('#register-fields').hidden=true;$('#register-fields input').required=false;$('#auth-submit').textContent='Sign in ↗';$('#login-tab').classList.add('active');$('#register-tab').classList.remove('active');};
  handleForm('#auth-form',async data=>{current=await api(register?'/api/register':'/api/login',data);updateIdentity();toast(register?`Account created. ${config?.mailMode==='local'?'Open .local-data/mail/ for verification.':'Check your email to verify it.'}`:'Welcome back.');location.hash=current.user.role==='player'?'library':'workspace';await render();});
}
function handleForm(selector,handler){
  const form=$(selector);form.addEventListener('submit',async e=>{e.preventDefault();const submit=e.submitter;const error=form.querySelector('.form-error');if(error)error.textContent='';submit.disabled=true;try{await handler(Object.fromEntries(new FormData(form)),form);}catch(err){if(error)error.textContent=err.message;else toast(err.message);}finally{submit.disabled=false;}});
}
async function renderWorkspace(version){
  if(!current.user || current.user.role==='player'){main.innerHTML=heading('MADE BY PEOPLE LIKE YOU','Your creator workspace.','Build something small. Share something wonderful.')+empty('A place for your next idea.','Sign in with a developer, reviewer, or administrator account to open this workspace.','<a class="button" href="#account">Open account ↗</a>');return;}
  main.innerHTML=heading('CREATOR WORKSPACE','Your games, thoughtfully shipped.','Loading your releases…');
  try{dashboard=await api('/api/dashboard');}catch(error){if(version===renderVersion)main.innerHTML=empty('Workspace unavailable',escape(error.message));return;}
  if(version!==renderVersion)return;
  const admin=current.user.role==='admin',reviewer=['admin','reviewer'].includes(current.user.role);
  const pending=dashboard.releases.filter(r=>r.state==='candidate').length,live=dashboard.games.filter(g=>g.active_release&&!g.disabled).length;
  main.innerHTML=heading(reviewer?'RELEASE CONTROL':'CREATOR WORKSPACE',reviewer?'A good release starts here.':'Bring your next idea to life.','Every candidate has a story. Every release has a recovery path.',current.user.role!=='reviewer'?button('+ Submit a game','submit','',''):'' )+
  `<div class="stats"><div class="stat"><strong>${dashboard.games.length}</strong><small>Games in your workspace</small></div><div class="stat"><strong>${pending}</strong><small>Awaiting review</small></div><div class="stat"><strong>${live}</strong><small>Live games</small></div><div class="stat"><strong>${dashboard.reports.filter(r=>r.status!=='resolved').length}</strong><small>Open issues</small></div></div>
  <div class="workspace-tabs">${['releases','history','issues','notifications',...(admin?['accounts','audit']:[])].map(tab=>`<button class="chip ${workspaceTab===tab?'active':''}" data-tab="${tab}">${tab[0].toUpperCase()+tab.slice(1)}</button>`).join('')}</div><section id="workspace-body" class="panel"></section>`;
  main.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{workspaceTab=b.dataset.tab;void render();});
  const body=$('#workspace-body');
  if(workspaceTab==='releases')body.innerHTML=`<div class="panel-head"><h2>Release library</h2>${button('Refresh','refresh','','small subtle')}</div>`+(dashboard.releases.length?dashboard.releases.map(r=>{
    const g=dashboard.games.find(g=>g.id===r.game_id);return `<article class="release-row"><div class="release-details"><h3>${escape(r.title)} <span class="fine">${escape(r.version)}</span></h3><span class="badge ${r.state}">${escape(r.state.replaceAll('_',' '))}</span>${r.active_release===r.id?'<span class="badge approved">LIVE</span>':''}${g.disabled?'<span class="badge rejected">DISABLED</span>':''}<p>${size(r.bytes)} · ${escape(JSON.parse(r.checks).join(' · '))}</p><code>SHA-256 ${escape(r.sha256)}</code><p>24h client reports: ${r.ready} ready · ${r.failed} failed</p>${r.feedback?`<p>Review: ${escape(r.feedback)}</p>`:''}</div><div class="actions">${button('Preview ↗','preview',r.id,'small subtle')}${reviewer&&r.state==='candidate'?button('Review','review',r.id,'small'):''}${admin&&r.state==='approved'?button(r.active_release===r.id?'Active':'Activate / roll back','activate',r.id,'small subtle'):''}${admin?button(g.disabled?'Enable game':'Disable game','availability',g.id,'small subtle'):''}</div></article>`;
  }).join(''):empty('No releases yet','Submit a self-contained HTML game to begin.'));
  if(workspaceTab==='history')body.innerHTML='<h2>Deployment history</h2>'+ (dashboard.deployments.length?dashboard.deployments.map(d=>`<article class="release-row"><div class="release-details"><h3>${escape(d.title)} · ${escape(d.version)}</h3><p>${escape(d.reason)}</p><p>${time(d.created)}</p></div><span class="badge">Revision ${d.revision}</span></article>`).join(''):empty('A fresh start','Approved activations and rollbacks will appear here.'));
  if(workspaceTab==='issues')body.innerHTML='<h2>Issues & feedback</h2>'+ (dashboard.reports.length?dashboard.reports.map(r=>`<article class="release-row"><div class="release-details"><h3>${escape(r.title)} · ${escape(r.version)}</h3><p>${escape(r.message)}</p><p>${escape(r.resolution)}</p><span class="badge">${escape(r.status)}</span></div>${button('Respond','resolve',r.id,'small subtle')}</article>`).join(''):empty('All quiet for now','Reports from players appear here.'));
  if(workspaceTab==='notifications')body.innerHTML='<h2>Your notifications</h2>'+(dashboard.notifications.length?dashboard.notifications.map(n=>`<article class="release-row"><div class="release-details"><p>${escape(n.message)}</p><p>${time(n.created)}</p></div></article>`).join(''):empty('You’re up to date','Review decisions and issue updates appear here.'));
  if(workspaceTab==='accounts'&&admin){const data=await api('/api/admin/users');if(version!==renderVersion)return;body.innerHTML='<h2>Account management</h2>'+data.users.map(u=>`<article class="release-row"><div class="release-details"><h3>${escape(u.name)}</h3><p>${escape(u.email)} · ${escape(u.role)} · ${u.suspended?'Suspended':u.verified?'Verified':'Unverified'}</p></div>${u.id!==current.user.id?button('Manage','manage-user',u.id,'small subtle'):''}</article>`).join('');body.users=data.users;}
  if(workspaceTab==='audit'&&admin){const data=await api('/api/admin/audit');if(version!==renderVersion)return;body.innerHTML='<h2>Audit trail</h2>'+data.events.map(e=>`<article class="release-row"><div class="release-details"><h3>${escape(e.action)}</h3><p>${escape(e.detail)}</p><code>${escape(e.target)}</code><p>${time(e.created)}</p></div></article>`).join('');}
}
function modal(title,content){$('#modal-content').innerHTML=`<h2 class="modal-title">${title}</h2>${content}`;$('#modal').showModal();}
function closeModal(){$('#modal').close();}
$('#modal-close').onclick=closeModal;
function input(label,name,value='',type='text'){return `<label>${label}<input name="${name}" type="${type}" value="${escape(value)}" required></label>`;}
function promptForm(title,content,handler,label='Save'){modal(title,`<form id="dialog-form">${content}<p class="form-error" role="alert"></p><button class="button">${label}</button></form>`);handleForm('#dialog-form',async(data,form)=>{await handler(data,form);closeModal();});}
async function accountLink(kind){
  const value=location.hash.slice(kind.length+2);
  if(kind==='verify'){try{await api('/api/account/verify',{token:value});toast('Email verified. You can now submit games.');}catch(e){toast(e.message);}location.hash='account';await refreshData();await render();}
  else {location.hash='account';promptForm('Choose a new password',input('New password (12+ characters)','password','','password'),async data=>{await api('/api/account/reset',{token:value,password:data.password});toast('Password reset. Sign in with your new password.');},'Reset password');}
}
async function renderOnline(version){
  if(!current.user){main.innerHTML=heading('A LITTLE FRIENDLY COMPETITION','Play together.','A server-validated game of three in a row.')+empty('Bring a friend. Make a move.','Sign in to join the matchmaking queue.','<a class="button" href="#account">Sign in ↗</a>');return;}
  main.innerHTML=heading('A LITTLE FRIENDLY COMPETITION','Three in a row.','Real opponents. Server-validated moves. One little match.')+`<div class="online-layout"><section class="panel"><div id="match"></div></section><section class="panel"><h2>The friendly leaderboard</h2><p>Wins calculated from completed server-validated matches.</p><div id="leaderboard"></div><p class="fine">Matches expire after 30 minutes of inactivity. Cancelled games do not award wins.</p></section></div>`;
  async function update(){try{const [data,leaders]=await Promise.all([api('/api/online/match'),api('/api/online/leaderboard')]);if(version!==renderVersion)return;const m=data.match;
    $('#match').innerHTML=!m||['cancelled','expired'].includes(m.state)?`<h2>A good game takes two.</h2><p>Join the queue. Invite a friend to sign in on another device or browser profile and join too.</p>${button('Find a match','join','','')}`:m.state==='waiting'?`<h2>Looking for a playmate…</h2><p>Waiting for another player to join.</p>${button('Cancel search','leave',m.id)}`:`<h2>${m.state==='won'?(m.winner===current.user.id?'A little victory!':'A good game. Try again?'):m.state==='draw'?'An even match.':m.turn===m.symbol?'Your move.':'Their move.'}</h2><p>You are ${m.symbol} · ${m.state==='playing'?'Match in progress':'Match complete'}</p><div class="board">${m.board.split('').map((cell,i)=>`<button data-cell="${i}" ${cell!=='-'||m.turn!==m.symbol||m.state!=='playing'?'disabled':''} aria-label="Cell ${i+1}: ${cell==='-'?'empty':cell}">${cell==='-'?'':cell}</button>`).join('')}</div>${m.state==='playing'?button('Leave match','leave',m.id):button('Play again','join','','')}`;
    main.querySelectorAll('[data-cell]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('/api/online/move',{matchId:m.id,revision:m.revision,cell:Number(b.dataset.cell)});await update();}catch(e){toast(e.message);await update();}});
    $('#leaderboard').innerHTML=leaders.scores.length?leaders.scores.map((s,i)=>`<div class="leaderboard-row"><span>${i+1}. ${escape(s.name)}</span><strong>${s.wins} wins</strong></div>`).join(''):'<p>No completed matches yet. Yours could be first.</p>';
  }catch(error){if(version===renderVersion)$('#match').textContent=`Online play needs a connection. ${error.message}`;}}
  await update();onlineTimer=setInterval(update,3000);
}
const actions={
  mfa:()=>{
    promptForm('Protect your account',`<p class="modal-copy">An authenticator app will generate one-time codes for sign-in. Keep your authenticator backup safe; email password reset does not remove this protection.</p>${input('Current password','password','','password')}`,async data=>{
      const result=await api('/api/account/mfa/setup',data);
      setTimeout(()=>promptForm('Connect your authenticator',`<p class="modal-copy">Add a time-based account in your authenticator using this secret. UNPLUG uses 6 digits and a 30-second period.</p><p><code>${escape(result.secret)}</code></p>${input('Authenticator code','otp')}`,async data=>{await api('/api/account/mfa/confirm',data);await refreshData();await render();toast('Authenticator protection enabled.');},'Verify & enable'),0);
    },'Continue');
  },
  workspace:()=>location.hash='workspace',refresh:async()=>{await refreshData();await render();},
  logout:async()=>{await api('/api/logout',{});current={user:null,csrf:null};dashboard=null;closeGame();updateIdentity();location.hash='account';await render();},
  resend:async()=>{await api('/api/account/resend',{});toast(config.mailMode==='local'?'Verification email saved in .local-data/mail/.':'Verification email sent.');},
  forgot:()=>promptForm('Recover your account',input('Email address','email','','email'),async data=>{const result=await api('/api/account/forgot',data);toast(result.message);},'Send recovery link'),
  revoke:async()=>{await api('/api/account/revoke',{});toast('Other sessions signed out.');},
  export:async()=>{const data=await api('/api/account/export');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='unplug-account.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
  'delete-account':()=>promptForm('Delete your account',`<p class="modal-copy">This anonymizes your profile, signs out your sessions, and disables your games. Release and audit records remain.</p>${input('Confirm your password','password','','password')}`,async data=>{await api('/api/account/delete',data);current={user:null,csrf:null};await refreshData();await render();toast('Account deleted.');},'Delete my account'),
  persist:async()=>{const granted=await navigator.storage?.persist?.();toast(granted?'Persistent storage granted. You can still clear it manually.':'Storage persistence was not granted by this browser.');},
  download:async id=>{
    const game=catalog.find(g=>g.release_id===id);if(!game)throw new Error('Refresh the catalog first.');
    const artifact=await api(`/api/artifacts/${id}`);if(artifact.sha256!==game.sha256)throw new Error('Catalog changed. Refresh before downloading.');
    await verifyArtifact(artifact,config.publicKey);
    await putDownload({...game,artifact,publicKey:config.publicKey,downloadedAt:Date.now()});downloads=await listDownloads();$('#download-count').textContent=downloads.length;toast(`${game.title} downloaded and verified. Ready offline.`);await render();
  },
  play:async id=>{const game=await getDownload(id);if(!game)throw new Error('Download this release first.');await playGame(game,game.artifact,game.publicKey);},
  remove:async id=>{const game=await getDownload(id);promptForm('Remove downloaded release',`<p class="modal-copy">Remove ${escape(game.title)} ${escape(game.version)} from this device? Other downloaded releases remain available.</p>`,async()=>{await deleteDownload(id);downloads=await listDownloads();$('#download-count').textContent=downloads.length;await render();},'Remove download');},
  preview:async id=>{const r=dashboard.releases.find(r=>r.id===id),artifact=await api('/api/preview',{releaseId:id});await playGame(r,artifact,config.publicKey,true);},
  submit:()=>{
    if(!current.user.verified){toast('Verify your email from Account before submitting.');return;}
    promptForm('Make room for your next game.',`<p class="modal-copy">One self-contained HTML file, up to 256 KiB. Classic inline scripts, embedded assets, no network access. <a href="/help.html" target="_blank" rel="noopener">Read the contract ↗</a></p><label>Game<select name="gameId"><option value="">Create a new game</option>${dashboard.games.filter(g=>current.user.role==='admin'||g.owner_id===current.user.id).map(g=>`<option value="${escape(g.id)}">${escape(g.title)}</option>`).join('')}</select></label>${input('Title','title')}<label>Description<textarea name="description" minlength="10" maxlength="500" required></textarea></label>${input('Version','version','1.0.0')}<label>HTML game file<input name="file" type="file" accept=".html,text/html" required></label>`,async(data,form)=>{const file=form.elements.file.files[0];if(file.size>256*1024)throw new Error('Game file exceeds 256 KiB.');await api('/api/submissions',{gameId:data.gameId||null,title:data.title,description:data.description,version:data.version,html:await file.text()});await render();toast('Candidate validated. Ready for restricted preview and review.');},'Validate & submit candidate');
  },
  review:id=>{const r=dashboard.releases.find(r=>r.id===id);promptForm(`Review ${escape(r.title)} ${escape(r.version)}`,`<p class="modal-copy">Approval applies to the exact digest below. Preview and play this candidate before approving.</p><p class="fine">${escape(r.sha256)}</p><label>Decision<select name="decision"><option value="approved">Approve candidate</option><option value="changes_requested">Request changes</option><option value="rejected">Reject candidate</option></select></label><label class="check"><input name="playable" type="checkbox">I played this candidate and checked its core gameplay.</label><label class="check"><input name="content" type="checkbox">I reviewed content and rights for publication.</label><label class="check"><input name="controls" type="checkbox">I checked controls, restart, and error behavior.</label><label>Feedback<textarea name="feedback" required minlength="3" maxlength="2000"></textarea></label>`,async(data,form)=>{await api('/api/review',{releaseId:id,sha256:r.sha256,decision:data.decision,feedback:data.feedback,checklist:Object.fromEntries(['playable','content','controls'].map(k=>[k,form.elements[k].checked]))});await render();toast('Review recorded against this artifact.');},'Record review');},
  activate:id=>{const r=dashboard.releases.find(r=>r.id===id),g=dashboard.games.find(g=>g.id===r.game_id);promptForm('Activate an approved release',`<p class="modal-copy">Make ${escape(r.title)} ${escape(r.version)} live? Choosing an earlier version performs a rollback. The artifact will not be rebuilt.</p>${input('Reason','reason')}`,async data=>{await api('/api/activate',{releaseId:id,sha256:r.sha256,expectedRevision:g.revision,reason:data.reason});await refreshData();await render();toast('Release activated. Deployment history updated.');},'Activate release');},
  availability:id=>{const g=dashboard.games.find(g=>g.id===id);promptForm(g.disabled?'Enable game':'Disable game',`<p class="modal-copy">${g.disabled?'Return this game to the live catalog.':'Hide this game and stop new downloads. Offline copies cannot receive an immediate remote change.'}</p>${input('Reason','reason')}`,async data=>{await api(`/api/games/${id}/availability`,{disabled:!g.disabled,reason:data.reason});await refreshData();await render();},g.disabled?'Enable':'Disable');},
  report:id=>promptForm('Tell us what happened.',`<label>Issue details<textarea name="message" required minlength="5" maxlength="2000"></textarea></label>`,async data=>{await api('/api/reports',{releaseId:id,message:data.message});toast('Report sent to the game owner and review team.');},'Send report'),
  resolve:id=>promptForm('Respond to an issue',`<label>Status<select name="status"><option value="investigating">Investigating</option><option value="resolved">Resolved</option><option value="open">Open</option></select></label><label>Response<textarea name="resolution" minlength="3" maxlength="1000" required></textarea></label>`,async data=>{await api(`/api/reports/${id}`,data);await render();},'Save response'),
  'manage-user':id=>{const u=$('#workspace-body').users.find(u=>u.id===id);promptForm(`Manage ${escape(u.name)}`,`<label>Role<select name="role">${['player','developer','reviewer','admin'].map(role=>`<option ${u.role===role?'selected':''}>${role}</option>`).join('')}</select></label><label class="check"><input name="suspended" type="checkbox" ${u.suspended?'checked':''}>Suspend account and revoke sessions</label>`,async(data,form)=>{await api(`/api/admin/users/${id}`,{role:data.role,suspended:form.elements.suspended.checked});await render();},'Update account');},
  join:async()=>{await api('/api/online/join',{});await render();},leave:async id=>{await api('/api/online/leave',{matchId:id});await render();}
};
document.addEventListener('click',async event=>{const b=event.target.closest('[data-action]');if(!b)return;const fn=actions[b.dataset.action];if(!fn)return;b.disabled=true;try{await fn(b.dataset.id);}catch(error){toast(error.message);}finally{b.disabled=false;}});
$('#account-button').onclick=()=>location.hash='account';
window.addEventListener('hashchange',()=>void render().catch(e=>toast(e.message)));
window.addEventListener('online',async()=>{await refreshData();await flushTelemetry();await render();});
window.addEventListener('offline',()=>connection(false));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){void flushTelemetry();}});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('#install').hidden=false;});
$('#install').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;$('#install').hidden=true;}};
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').then(reg=>{
    function update(){if(reg.waiting && navigator.serviceWorker.controller){$('#update').hidden=false;$('#update').onclick=()=>{if(!reg.waiting)return;updateRequested=true;closeGame();reg.waiting.postMessage({type:'ACTIVATE_UPDATE'});};}}
    update();reg.addEventListener('updatefound',()=>reg.installing?.addEventListener('statechange',update));
  }).catch(()=>toast('Offline shell installation failed. Refresh while connected.'));
  let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloading&&updateRequested){reloading=true;location.reload();}});
}
await refreshData();await render();void flushTelemetry();
