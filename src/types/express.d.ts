declare global {
  namespace Express {
    interface Request {
      // the body as received, for the webhooks whose signature covers it (Polar)
      rawBody?: string;
    }
  }
}

export {};
