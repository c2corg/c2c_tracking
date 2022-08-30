export const checkEnvvars = (...envvars: string[]): void => {
  envvars.forEach((envvar) => {
    // eslint-disable-next-line security/detect-object-injection
    if (!process.env[envvar]) {
      throw new Error(`Missing configuration variable: ${envvar}`);
    }
  });
};
