/*
 * HTTP client of the vendor APIs, on Node's fetch. It keeps the shape the code used with axios: `{ status, data }`
 * responses, `params`, basic `auth`, JSON or form bodies, and an error for any status outside 2xx.
 */

export type HttpOptions = {
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  auth?: { username: string; password: string };
  // the body as JSON (or text when it is not JSON) by default, as text, or as an ArrayBuffer
  responseType?: 'json' | 'text' | 'arraybuffer';
  // ms, 30 s by default
  timeout?: number;
  // the statuses that are not errors, 2xx by default
  validateStatus?: (status: number) => boolean;
};

export type HttpResponse<T> = { status: number; data: T };

type Body = Record<string, unknown> | unknown[] | URLSearchParams | string | null | undefined;

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * A failed request: a status outside 2xx, or no answer (`code`: ECONNREFUSED, ETIMEDOUT...). It holds no request
 * header, body or query string, which may contain secrets: it can be logged as is.
 */
export class HttpError extends Error {
  public readonly method: string;
  public readonly url: string;
  public readonly status: number | undefined;
  public readonly code: string | undefined;
  public readonly data: unknown;

  constructor(
    message: string,
    request: { method: string; url: string },
    details: { status?: number; code?: string; data?: unknown; cause?: unknown },
  ) {
    super(message, details.cause === undefined ? undefined : { cause: details.cause });
    this.name = 'HttpError';
    this.method = request.method;
    this.url = request.url.split('?')[0] ?? request.url;
    this.status = details.status;
    this.code = details.code;
    this.data = details.data;
  }
}

export const isHttpError = (error: unknown): error is HttpError => error instanceof HttpError;

const withParams = (url: string, params: HttpOptions['params']): string => {
  if (!params) {
    return url;
  }
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      target.searchParams.append(key, String(value));
    }
  }
  return target.toString();
};

const encodeBody = (body: Body, headers: Headers): RequestInit['body'] => {
  if (body === undefined || body === null) {
    return undefined;
  }
  if (body instanceof URLSearchParams) {
    return body; // fetch sets the form content type
  }
  if (typeof body === 'string') {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/x-www-form-urlencoded');
    }
    return body;
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return JSON.stringify(body);
};

const parseBody = async (response: Response, responseType: HttpOptions['responseType']): Promise<unknown> => {
  if (responseType === 'arraybuffer') {
    return response.arrayBuffer();
  }
  const text = await response.text();
  if (responseType === 'text') {
    return text;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const request = async <T>(
  method: string,
  url: string,
  body: Body,
  options: HttpOptions = {},
): Promise<HttpResponse<T>> => {
  const target = withParams(url, options.params);
  const headers = new Headers(options.headers);
  if (options.auth) {
    const credentials = Buffer.from(`${options.auth.username}:${options.auth.password}`).toString('base64');
    headers.set('Authorization', `Basic ${credentials}`);
  }
  const requestBody = encodeBody(body, headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json, text/plain, */*');
  }
  let response: Response;
  try {
    response = await fetch(target, {
      method,
      headers,
      ...(requestBody !== undefined && { body: requestBody }),
      signal: AbortSignal.timeout(options.timeout ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (error: unknown) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    const cause = error instanceof Error ? (error.cause as { code?: string } | undefined) : undefined;
    throw new HttpError(
      timedOut ? 'Request timed out' : 'Request failed',
      { method, url: target },
      {
        code: timedOut ? 'ETIMEDOUT' : (cause?.code ?? 'ERR_NETWORK'),
        cause: error,
      },
    );
  }
  const data = await parseBody(response, options.responseType);
  const valid = options.validateStatus ?? ((status: number): boolean => status >= 200 && status < 300);
  if (!valid(response.status)) {
    throw new HttpError(
      `Request failed with status code ${response.status}`,
      { method, url: target },
      {
        status: response.status,
        code: response.status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST',
        data,
      },
    );
  }
  return { status: response.status, data: data as T };
};

export const http = {
  get: <T = unknown>(url: string, options?: HttpOptions): Promise<HttpResponse<T>> =>
    request<T>('GET', url, undefined, options),
  delete: <T = unknown>(url: string, options?: HttpOptions): Promise<HttpResponse<T>> =>
    request<T>('DELETE', url, undefined, options),
  post: <T = unknown>(url: string, body?: Body, options?: HttpOptions): Promise<HttpResponse<T>> =>
    request<T>('POST', url, body, options),
  // the fields as an application/x-www-form-urlencoded body
  postForm: <T = unknown>(
    url: string,
    fields: Record<string, string>,
    options?: HttpOptions,
  ): Promise<HttpResponse<T>> => request<T>('POST', url, new URLSearchParams(fields), options),
};
