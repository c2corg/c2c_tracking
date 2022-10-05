import { GenericContainer, StartedTestContainer } from 'testcontainers';

import { initDb } from './init-db';

const spawnDatabase = (): Promise<StartedTestContainer> =>
  new GenericContainer('postgres')
    .withEnv('POSTGRES_USER', 'postgres')
    .withEnv('POSTGRES_DB', 'postgres')
    .withEnv('POSTGRES_PASSWORD', 'postgres')
    .withExposedPorts({ container: 5432, host: 5432 })
    .withTmpFs({ '/temp_pgdata': 'rw,noexec,nosuid,size=65536k' })
    .start();

const shareContainerForTeardown = (container: StartedTestContainer): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__DATABASE_CONTAINER__ = container;
};

const setupDatabase = async (): Promise<void> => {
  const container = await spawnDatabase();
  shareContainerForTeardown(container);
  await initDb();
};

export default setupDatabase;
