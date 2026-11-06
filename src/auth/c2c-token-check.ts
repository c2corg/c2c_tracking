import { createHash } from 'node:crypto';

import axios from 'axios';

import log from '../helpers/logger.ts';

const CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 5_000;
// beyond this size, the expired entries are dropped before adding one
const CACHE_PRUNE_SIZE = 10_000;

type CacheEntry = { valid: boolean; until: number };

/**
 * Asks the c2c API whether a token is still valid: its signature is not enough, the token may have been revoked
 * (logout, renewal) or its user blocked.
 *
 * The answers are cached for a minute, by the hash of the token. Without an answer from the API (network error, 5xx),
 * the token is refused and nothing is cached.
 */
export class TokenChecker {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly apiBaseUrl: string;
  private readonly ttl: number;
  private readonly now: () => number;

  constructor(apiBaseUrl: string, ttl = CACHE_TTL_MS, now: () => number = Date.now) {
    this.apiBaseUrl = apiBaseUrl;
    this.ttl = ttl;
    this.now = now;
  }

  public async isValid(token: string, userId: number): Promise<boolean> {
    const key = createHash('sha256').update(token).digest('hex');
    const cached = this.cache.get(key);
    if (cached && cached.until > this.now()) {
      return cached.valid;
    }

    const valid = await this.ask(token, userId);
    if (valid === undefined) {
      return false;
    }
    this.prune();
    this.cache.set(key, { valid, until: this.now() + this.ttl });
    return valid;
  }

  /** Returns the answer of the API, undefined without one. */
  private async ask(token: string, userId: number): Promise<boolean | undefined> {
    try {
      const response = await axios.get<{ user?: unknown }>(new URL('users/token', this.apiBaseUrl).toString(), {
        headers: { Authorization: `JWT token="${token}"` },
        timeout: REQUEST_TIMEOUT_MS,
        validateStatus: () => true,
      });
      if (response.status === 200) {
        return response.data?.user === userId;
      }
      if (response.status === 401 || response.status === 403) {
        return false;
      }
      log.warn(`Token check: the API answered ${response.status}`);
    } catch (error: unknown) {
      log.warn(`Token check: no answer from the API: ${error instanceof Error ? error.message : String(error)}`);
    }
    return undefined;
  }

  private prune(): void {
    if (this.cache.size < CACHE_PRUNE_SIZE) {
      return;
    }
    const now = this.now();
    for (const [key, entry] of this.cache) {
      if (entry.until <= now) {
        this.cache.delete(key);
      }
    }
  }
}
