import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateGame } from '../services/contracts.mjs';
const [gameId,version,revision='HEAD']=process.argv.slice(2);
if(!/^[a-z][a-z0-9-]{0,50}$/.test(gameId || ''))throw new Error('Usage: node tools/package-release.mjs GAME_ID VERSION [COMMIT]');
if(!/^(HEAD|[a-f0-9]{40})$/.test(revision))throw new Error('Use HEAD or a full commit SHA.');
const commit=execFileSync('git',['rev-parse','--verify',`${revision}^{commit}`],{encoding:'utf8'}).trim();
// Read committed bytes, never working-tree bytes with a misleading source SHA.
const html=execFileSync('git',['show',`${commit}:games/${gameId}.html`],{encoding:'utf8',maxBuffer:512*1024});
const contract=validateGame(version,html);
const payload={contractVersion:1,gameId,version,sourceCommit:commit,html,sha256:contract.sha256,bytes:contract.bytes};
const dir=`artifacts/releases/${gameId}-${version}`;
await mkdir(dir,{recursive:true});
await writeFile(`${dir}/candidate.json`,JSON.stringify(payload,null,2),{flag:'wx'});
await writeFile(`${dir}/game.html`,html,{flag:'wx'});
await writeFile(`${dir}/SHA256SUMS`,`${createHash('sha256').update(html).digest('hex')}  game.html\n`);
console.log(`Packaged committed game ${gameId} ${version} from ${commit}\n${dir}`);
