import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { token,digest } from '../services/security.mjs';
const [gameId,days='30']=process.argv.slice(2);
if(!gameId||!/^\d+$/.test(days)||Number(days)<1||Number(days)>90)throw new Error('Usage: node --env-file-if-exists=.env tools/create-ci-token.mjs GAME_ID [DAYS:1-90]');
const db=new DatabaseSync(path.resolve(process.env.DATA_DIR||'.local-data','unplug.sqlite'));
try{
  const game=db.prepare('SELECT id FROM games WHERE id=?').get(gameId);if(!game)throw new Error('Game not found. Start the platform first.');
  const value=token();db.prepare('INSERT INTO ci_tokens VALUES(?,?,?,?,?)').run(digest(value),gameId,Date.now()+Number(days)*86400000,'local-operator',Date.now());
  db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?)').run(randomUUID(),'local-operator','ci.token_created',gameId,`Expires in ${days} days`,Date.now());
  console.log(`Store this token securely as UNPLUG_CI_TOKEN. It can only stage candidates for ${gameId}, not approve or activate them.\n${value}`);
}finally{db.close();}
