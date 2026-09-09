import { createApp } from './app.mjs';
const host=process.env.HOST || '127.0.0.1';
const port=Number(process.env.PORT || 3000);
const context=await createApp();
const server=context.app.listen(port,host,()=>{
  console.log(`\nUNPLUG is running at ${process.env.PUBLIC_ORIGIN || `http://${host}:${port}`}\n`);
  console.log(`First administrator credentials: ${context.dataDir}/first-login.txt`);
  console.log(`Local verification/recovery emails: ${context.dataDir}/mail/`);
  console.log('Press Ctrl+C to stop.');
});
server.on('error',error=>{console.error(error.message);context.close();process.exitCode=1;});
let stopping=false;
function stop(){if(stopping)return;stopping=true;server.close(()=>context.close());server.closeIdleConnections();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
