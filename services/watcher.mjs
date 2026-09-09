import { openDatabase } from './database.mjs';
import { rebuildAndDeploy } from './packager.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = path.resolve(process.env.DATA_DIR || '.local-data');
const db = openDatabase(path.join(dataDir, 'unplug.sqlite'));

// Track known approved release IDs
let knownApproved = new Set(
  db.prepare("SELECT id FROM releases WHERE state = 'approved'").all().map(r => r.id)
);

console.log(`[Watcher] UNPLUG Approval Watcher active. Currently approved: ${[...knownApproved].join(', ') || 'None'}`);

setInterval(async () => {
  try {
    const currentApproved = db.prepare("SELECT id, game_id, version FROM releases WHERE state = 'approved'").all();
    const currentIds = new Set(currentApproved.map(r => r.id));

    let hasNewApproval = false;
    for (const rel of currentApproved) {
      if (!knownApproved.has(rel.id)) {
        console.log(`[Watcher] Detected newly approved release: ${rel.game_id} ${rel.version} (${rel.id})`);
        hasNewApproval = true;
      }
    }

    if (hasNewApproval || currentIds.size !== knownApproved.size) {
      knownApproved = currentIds;
      console.log('[Watcher] Triggering automated rebuild and deploy pipeline...');
      await rebuildAndDeploy({ db, dataDir });
    }
  } catch (err) {
    console.error('[Watcher] Error checking database for approvals:', err.message);
  }
}, 2000);
