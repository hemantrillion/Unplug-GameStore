import { readFile } from 'node:fs/promises';
const [filename]=process.argv.slice(2);
if(!filename||!process.env.UNPLUG_API_URL||!process.env.UNPLUG_CI_TOKEN)throw new Error('Set UNPLUG_API_URL and UNPLUG_CI_TOKEN and pass candidate.json.');
const origin=new URL(process.env.UNPLUG_API_URL);
if(origin.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(origin.hostname))throw new Error('Staging requires HTTPS outside local development.');
const result=await fetch(new URL('/api/ci/candidates',origin),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.UNPLUG_CI_TOKEN}`},body:await readFile(filename,'utf8'),signal:AbortSignal.timeout(30000)});
const body=await result.json();if(!result.ok)throw new Error(body.error||`Staging failed: ${result.status}`);
console.log(JSON.stringify(body,null,2));
