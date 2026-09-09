const {app,BrowserWindow,ipcMain,session}=require('electron');
const {readFile,writeFile}=require('node:fs/promises');
const path=require('node:path');
let setup,workspace;
function validate(value){const url=new URL(value);if(url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('Enter only the service origin, for example https://unplug.example.com');if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)))throw new Error('Use HTTPS, or a loopback address for local development.');return url.origin;}
async function openWorkspace(origin){
  if(workspace&&!workspace.isDestroyed())workspace.close();
  workspace=new BrowserWindow({width:1440,height:980,minWidth:800,minHeight:600,backgroundColor:'#f6f5f1',title:'UNPLUG Desktop',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,partition:'persist:unplug'}});
  workspace.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  workspace.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault();});
  workspace.webContents.on('will-attach-webview',event=>event.preventDefault());
  await workspace.loadURL(origin);
  if(setup&&!setup.isDestroyed())setup.close();
}
app.whenReady().then(async()=>{
  session.fromPartition('persist:unplug').setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  session.fromPartition('persist:unplug').setPermissionCheckHandler(()=>false);
  let origin;
  try{origin=validate(JSON.parse(await readFile(path.join(app.getPath('userData'),'service.json'),'utf8')).origin);}catch{}
  if(process.env.UNPLUG_ORIGIN)origin=validate(process.env.UNPLUG_ORIGIN);
  if(origin){try{await openWorkspace(origin);return;}catch{}}
  setup=new BrowserWindow({width:660,height:600,resizable:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  // A narrowly scoped local form submission avoids exposing any IPC or native bridge to the hosted workspace.
  setup.webContents.on('will-navigate',async(event,url)=>{
    event.preventDefault();
    const parsed=new URL(url);if(parsed.protocol!=='unplug-setup:')return;
    try{const selected=validate(parsed.searchParams.get('origin'));await writeFile(path.join(app.getPath('userData'),'service.json'),JSON.stringify({origin:selected}),{mode:0o600});await openWorkspace(selected);}catch(error){await setup.webContents.executeJavaScript(`document.querySelector('#message').textContent=${JSON.stringify(error.message)}`);}
  });
  setup.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  await setup.loadFile(path.join(__dirname,'setup.html'));
});
app.on('window-all-closed',()=>app.quit());
