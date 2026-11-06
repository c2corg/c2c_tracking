import rTracer from 'cls-rtracer';

// The id of the request being handled, undefined outside of a request
export const currentRequestId = (): string | undefined => {
  const id = rTracer.id();
  return typeof id === 'string' ? id : undefined;
};
