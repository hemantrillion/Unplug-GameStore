import { DatabaseSync, backup } from 'node:sqlite';
import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const data=path.resolve(process.env.DATA_DIR || '.local-data');
const destination=path.resolve(process.argv[2] || path.join('artifacts','backups',new Date().toISOString().replaceAll(':','-')));
await mkdir(destination,{recursive:true,mode:0o700});
const db=new DatabaseSync(path.join(data,'unplug.sqlite'),{readOnly:true});
try{await backup(db,path.join(destination,'unplug.sqlite'));}finally{db.close();}
await copyFile(path.join(data,'release-key.pem'),path.join(destination,'release-key.pem'));
const checksums={};for(const name of ['unplug.sqlite','release-key.pem'])checksums[name]=createHash('sha256').update(await readFile(path.join(destination,name))).digest('hex');
await writeFile(path.join(destination,'manifest.json'),JSON.stringify({version:1,created:new Date().toISOString(),checksums},null,2),{mode:0o600});
console.log(`Consistent database and signing-key backup: ${destination}\nProtect and copy it off-device. The backup contains sensitive account and signing material.`);
