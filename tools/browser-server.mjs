import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../services/app.mjs';
const dir=await mkdtemp(path.join(tmpdir(),'unplug-browser-'));
const context=await createApp({dataDir:dir,origin:'http://127.0.0.1:3100',adminEmail:'admin@test.local',adminPassword:'browser-test-password-123',disableLimits:true});
const server=context.app.listen(3100,'127.0.0.1');
function close(){server.close(async()=>{context.close();await rm(dir,{recursive:true,force:true});});server.closeAllConnections();}
process.on('SIGINT',close);process.on('SIGTERM',close);
