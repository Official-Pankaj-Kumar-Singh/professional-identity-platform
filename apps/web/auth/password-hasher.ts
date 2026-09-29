import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import type { PasswordHashResult } from "../account/types";
import type { PasswordVerifier } from "./types";

/** Subset of Node's `crypto.ScryptOptions` used by this module. */
interface ScryptOptions {
  N: number;
  r: number;
  p: number;
  maxTime?: number;
}

const scryptAsync = promisify(scrypt);

/** Parameters controlling the scrypt work factor. */
export interface PasswordHasherOptions {
  /** CPU/Memory cost factor (N = 2 ** logN). Must be >= 4. */
  logN: number;
  /** Block size parameter (r). */
  r: number;
  /** Parallelism parameter (p). */
  p: number;
  /** Output length in bytes (dkLen). */
  keyLength: number;
  /** Maximum wall-clock budget for a single hash in milliseconds. */
  maxTimeMs: number;
}

const DEFAULT_OPTIONS: PasswordHasherOptions = {
  logN: 14,
  r: 8,
  p: 1,
  keyLength: 64,
  maxTimeMs: 2000,
};

/**
 * Format: `scrypt$<logN>$<r>$<p>$<saltB64>$<hashB64>`.
 *
 * The format is deliberately self-describing so a single verifier can read
 * any hash produced by this implementation, and the parameters travel with
 * the hash so future re-hashing can raise the work factor.
 */
const PREFIX = "scrypt";

function encodeBase64(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function decodeBase64(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function constantTimeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function deriveAsync(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (err, derivedKey) => {
      if (err || !Buffer.isBuffer(derivedKey)) reject(err ?? new Error("scrypt produced no key"));
      else resolve(derivedKey);
    });
  });
}

/**
 * Production-safe password hashing backed by Node's `crypto.scrypt`.
 *
 * - Never stores or returns the raw password.
 * - Uses a random per-hash salt.
 * - Rejects empty hashes and hashes identical to the raw password.
 * - Constant-time comparison when verifying.
 */
export class ScryptPasswordHasher {
  private readonly options: PasswordHasherOptions;

  constructor(options: Partial<PasswordHasherOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    if (this.options.logN < 4) throw new Error("logN must be >= 4");
    if (this.options.r < 1) throw new Error("r must be >= 1");
    if (this.options.p < 1) throw new Error("p must be >= 1");
    if (this.options.keyLength < 16) throw new Error("keyLength must be >= 16");
  }

  async hash(password: string): Promise<PasswordHashResult> {
    if (typeof password !== "string" || password.length === 0) {
      return { ok: false };
    }

    const salt = randomBytes(16);
    const derived = await deriveAsync(password, salt, this.options.keyLength, {
      N: 2 ** this.options.logN,
      r: this.options.r,
      p: this.options.p,
      maxTime: this.options.maxTimeMs,
    });

    if (derived.length !== this.options.keyLength) {
      return { ok: false };
    }

    const encoded = [
      PREFIX,
      String(this.options.logN),
      String(this.options.r),
      String(this.options.p),
      encodeBase64(salt),
      encodeBase64(derived),
    ].join("$");

    return { ok: true, passwordHash: encoded };
  }
}

/**
 * Verifier for hashes produced by {@link ScryptPasswordHasher}.
 *
 * Reads the parameters embedded in the hash so verification matches the
 * work factor that was used at hash time.
 */
export class ScryptPasswordVerifier implements PasswordVerifier {
  async verify(password: string, passwordHash: string): Promise<{ ok: true } | { ok: false }> {
    if (typeof password !== "string" || typeof passwordHash !== "string") {
      return { ok: false };
    }

    const parts = passwordHash.split("$");
    if (parts[0] !== "scrypt" || parts.length !== 6) {
      return { ok: false };
    }

    const logN = Number.parseInt(parts[1], 10);
    const r = Number.parseInt(parts[2], 10);
    const p = Number.parseInt(parts[3], 10);
    const salt = decodeBase64(parts[4]);
    const expected = decodeBase64(parts[5]);

    if (!Number.isSafeInteger(logN) || logN < 4) return { ok: false };
    if (!Number.isSafeInteger(r) || r < 1) return { ok: false };
    if (!Number.isSafeInteger(p) || p < 1) return { ok: false };
    if (salt.length === 0 || expected.length === 0) return { ok: false };

    let derived: Buffer;
    try {
      derived = await deriveAsync(password, salt, expected.length, {
        N: 2 ** logN,
        r,
        p,
        maxTime: DEFAULT_OPTIONS.maxTimeMs,
      });
    } catch {
      return { ok: false };
    }

    if (!constantTimeEqual(derived, expected)) {
      return { ok: false };
    }

    return { ok: true };
  }
}

/** Convenience factory matching the injected `PasswordHasher` / `PasswordVerifier` contracts. */
export function createPasswordHasher(): {
  hasher: ScryptPasswordHasher;
  verifier: ScryptPasswordVerifier;
} {
  const hasher = new ScryptPasswordHasher();
  const verifier = new ScryptPasswordVerifier();
  return { hasher, verifier };
}

export type { PasswordVerifier };