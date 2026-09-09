import { readFile, mkdir, copyFile, access } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import path from 'node:path';
const [source,target]=process.argv.slice(2);
if(!source||!target)throw new Error('Usage: node tools/restore.mjs BACKUP_DIRECTORY NEW_DATA_DIRECTORY');
try{await access(target);throw new Error('Destination already exists. Restore into a new directory.');}catch(error){if(error.code!=='ENOENT')throw error;}
const manifest=JSON.parse(await readFile(path.join(source,'manifest.json'),'utf8'));
if(manifest.version!==1)throw new Error('Unsupported backup format.');
for(const name of ['unplug.sqlite','release-key.pem']){const hash=createHash('sha256').update(await readFile(path.join(source,name))).digest('hex');if(hash!==manifest.checksums[name])throw new Error(`Backup checksum mismatch: ${name}`);}
await mkdir(target,{recursive:true,mode:0o700});
for(const name of ['unplug.sqlite','release-key.pem'])await copyFile(path.join(source,name),path.join(target,name));
const db=new DatabaseSync(path.join(target,'unplug.sqlite'));
try{const check=db.prepare('PRAGMA integrity_check').get();if(check.integrity_check!=='ok')throw new Error('Restored database integrity check failed.');if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Restored foreign keys are invalid.');db.exec('DELETE FROM sessions; DELETE FROM account_tokens;');}finally{db.close();}
console.log(`Restore verified at ${path.resolve(target)}. Sessions and recovery tokens were revoked. Start a separate test instance with DATA_DIR set here.`);
