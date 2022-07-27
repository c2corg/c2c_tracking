export const checkEnvvars = (...envvars: string[]): void => {
  envvars.forEach((envvar) => {
    if (!process.env[envvar]) {
      throw new Error(`Missing configuration variable: ${envvar}`);
    }
  });
};
