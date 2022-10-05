const teardownDatabase = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__DATABASE_CONTAINER__.stop();
};

export default teardownDatabase;
