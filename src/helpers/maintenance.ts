import { existsSync, type FSWatcher, watch } from 'node:fs';
import path from 'node:path';

export const MAINTENANCE_FILE = 'maintenance_mode.txt';

// Calls `onMaintenance` when the maintenance file is created or modified in `directory` (not when it is removed)
export const watchMaintenanceFile = (directory: string, onMaintenance: () => void): FSWatcher =>
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- the directory comes from the code, not from input
  watch(directory, (_eventType, filename) => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed file name in the watched directory
    if (filename === MAINTENANCE_FILE && existsSync(path.join(directory, MAINTENANCE_FILE))) {
      onMaintenance();
    }
  });
