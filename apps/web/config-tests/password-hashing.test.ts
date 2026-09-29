import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ScryptPasswordHasher, ScryptPasswordVerifier, createPasswordHasher } from "../auth/password-hasher";
import type { PasswordHashResult } from "../account/types";

describe("password hashing (production infrastructure)", () => {
  const password = "correct horse battery staple";

  it("produces a salted, non-reversible hash distinct from the raw password", async () => {
    const hasher = new ScryptPasswordHasher({ logN: 10, r: 4, p: 1, keyLength: 32, maxTimeMs: 1000 });
    const result: PasswordHashResult = await hasher.hash(password);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.notEqual(result.passwordHash, password);
    assert.ok(result.passwordHash.startsWith("scrypt$"));
    assert.ok(result.passwordHash.includes(password) === false);
  });

  it("verifies a correct password and rejects an incorrect one", async () => {
    const hasher = new ScryptPasswordHasher({ logN: 10, r: 4, p: 1, keyLength: 32, maxTimeMs: 1000 });
    const verifier = new ScryptPasswordVerifier();
    const hashed = await hasher.hash(password);
    assert.equal(hashed.ok, true);
    if (!hashed.ok) return;

    const good = await verifier.verify(password, hashed.passwordHash);
    const bad = await verifier.verify("wrong password", hashed.passwordHash);

    assert.equal(good.ok, true);
    assert.equal(bad.ok, false);
  });

  it("rejects empty and malformed hashes", async () => {
    const hasher = new ScryptPasswordHasher({ logN: 10, r: 4, p: 1, keyLength: 32, maxTimeMs: 1000 });
    const verifier = new ScryptPasswordVerifier();

    assert.equal((await hasher.hash("")).ok, false);
    assert.equal((await verifier.verify(password, "")).ok, false);
    assert.equal((await verifier.verify(password, "not-a-hash")).ok, false);
    assert.equal((await verifier.verify(password, "$scrypt$14$8$1$zzz$yyy")).ok, false);
  });

  it("produces distinct hashes for the same password (per-hash salt)", async () => {
    const hasher = new ScryptPasswordHasher({ logN: 10, r: 4, p: 1, keyLength: 32, maxTimeMs: 1000 });
    const a = await hasher.hash(password);
    const b = await hasher.hash(password);

    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (a.ok && b.ok) assert.notEqual(a.passwordHash, b.passwordHash);
  });

  it("exposes the factory contract used by composition", () => {
    const { hasher, verifier } = createPasswordHasher();
    assert.ok(hasher instanceof ScryptPasswordHasher);
    assert.ok(verifier instanceof ScryptPasswordVerifier);
  });
});