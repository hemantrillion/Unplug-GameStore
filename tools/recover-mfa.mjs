import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
const [email,confirmation]=process.argv.slice(2);
if(!email||confirmation!=='--confirm-local-operator')throw new Error('Usage: node --env-file-if-exists=.env tools/recover-mfa.mjs EMAIL --confirm-local-operator');
const db=new DatabaseSync(path.resolve(process.env.DATA_DIR||'.local-data','unplug.sqlite'));
try{const user=db.prepare('SELECT id FROM users WHERE email=?').get(email);if(!user)throw new Error('Account not found.');db.exec('BEGIN IMMEDIATE');db.prepare('UPDATE users SET mfa_secret=NULL,mfa_pending=NULL,mfa_last_step=-1 WHERE id=?').run(user.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?)').run(randomUUID(),'local-operator','account.mfa_recovered',user.id,'Operator recovery; all sessions revoked',Date.now());db.exec('COMMIT');console.log('Authenticator reset recorded. Re-enroll immediately after signing in.');}finally{db.close();}
