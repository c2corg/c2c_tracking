import type { FSWatcher } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAINTENANCE_FILE, watchMaintenanceFile } from '../../../src/helpers/maintenance.ts';

describe('watchMaintenanceFile', () => {
  let directory: string;
  let watcher: FSWatcher | undefined;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'maintenance-'));
  });

  afterEach(async () => {
    watcher?.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('calls back when the maintenance file is created', async () => {
    const onMaintenance = vi.fn();
    watcher = watchMaintenanceFile(directory, onMaintenance);

    await writeFile(path.join(directory, MAINTENANCE_FILE), '');

    await vi.waitFor(() => expect(onMaintenance).toHaveBeenCalled());
  });

  it('calls back when the maintenance file is modified', async () => {
    await writeFile(path.join(directory, MAINTENANCE_FILE), '');
    const onMaintenance = vi.fn();
    watcher = watchMaintenanceFile(directory, onMaintenance);

    await writeFile(path.join(directory, MAINTENANCE_FILE), 'on');

    await vi.waitFor(() => expect(onMaintenance).toHaveBeenCalled());
  });

  it('ignores the removal of the maintenance file and other files', async () => {
    await writeFile(path.join(directory, MAINTENANCE_FILE), '');
    const onMaintenance = vi.fn();
    const onOther = vi.fn();
    watcher = watchMaintenanceFile(directory, onMaintenance);
    // a second watcher tells when the events were delivered
    const witness = watchMaintenanceFile(directory, () => undefined);
    witness.on('change', onOther);

    await rm(path.join(directory, MAINTENANCE_FILE));
    await writeFile(path.join(directory, 'other.txt'), '');

    await vi.waitFor(() => expect(onOther).toHaveBeenCalledWith(expect.anything(), 'other.txt'));
    witness.close();
    expect(onMaintenance).not.toHaveBeenCalled();
  });
});
