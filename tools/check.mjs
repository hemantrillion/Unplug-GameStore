import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { validateGame } from '../services/contracts.mjs';
async function walk(folder){for(const e of await readdir(folder,{withFileTypes:true})){const file=path.join(folder,e.name);if(e.isDirectory())await walk(file);else if(/\.(js|mjs)$/.test(file)){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}}}
for(const folder of ['services','web','tools','tests'])await walk(folder);
for(const name of await readdir('games'))if(name.endsWith('.html'))validateGame('1.0.0',await readFile(path.join('games',name),'utf8'));
JSON.parse(await readFile('web/manifest.webmanifest','utf8'));
console.log('JavaScript, game contracts and manifest checks passed.');
