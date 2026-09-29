import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAccountService } from "../account";
import type {
  Account,
  AccountCreationDependencies,
  AccountRepositoryResult,
  NewAccountRecord,
  PasswordHashResult,
} from "../account";

const rawPassword = "correct horse battery staple";

function createFixture(options: {
  exists?: AccountRepositoryResult<boolean>;
  created?: AccountRepositoryResult<Account>;
  hash?: PasswordHashResult;
  hashThrows?: boolean;
  existsThrows?: boolean;
} = {}) {
  const records: NewAccountRecord[] = [];
  let hashCalls = 0;
  const account: Account = {
    id: "account-123",
    email: "person@example.com",
    createdAt: "2026-09-28T00:00:00Z",
    updatedAt: "2026-09-28T00:00:00Z",
  };
  const dependencies: AccountCreationDependencies = {
    repository: {
      async existsByEmail() {
        if (options.existsThrows) throw new Error("private storage detail");
        return options.exists ?? { ok: true, value: false };
      },
      async create(record) {
        records.push(record);
        return options.created ?? { ok: true, value: record.account };
      },
    },
    passwordHasher: {
      async hash(password) {
        hashCalls += 1;
        assert.equal(password, rawPassword);
        if (options.hashThrows) throw new Error("private hashing detail");
        return options.hash ?? { ok: true, passwordHash: "salted-hash-value" };
      },
    },
    createAccountId: () => account.id,
    now: () => account.createdAt,
  };

  return { service: createAccountService(dependencies), records, account, get hashCalls() { return hashCalls; } };
}

describe("account creation service (Task #94)", () => {
  it("creates a normalized account and persists only a hash", async () => {
    const fixture = createFixture();
    const result = await fixture.service.create({ email: "  Person@Example.com ", password: rawPassword });

    assert.equal(result.ok, true);
    assert.equal(fixture.records.length, 1);
    assert.equal(fixture.records[0].account.email, "person@example.com");
    assert.equal(fixture.records[0].credential.accountId, "account-123");
    assert.equal(fixture.records[0].credential.passwordHash, "salted-hash-value");
    assert.equal(JSON.stringify(fixture.records).includes(rawPassword), false);
    if (result.ok) {
      assert.deepEqual(result.account, fixture.account);
      assert.equal("password" in result.account, false);
      assert.equal("passwordHash" in result.account, false);
    }
  });

  it("rejects missing email or password before accessing dependencies", async () => {
    const fixture = createFixture();
    const noEmail = await fixture.service.create({ email: "  ", password: rawPassword });
    const noPassword = await fixture.service.create({ email: "person@example.com", password: "" });

    assert.equal(noEmail.ok, false);
    assert.equal(noPassword.ok, false);
    assert.equal(fixture.hashCalls, 0);
    assert.equal(fixture.records.length, 0);
  });

  it("rejects an existing normalized identity without returning identity details", async () => {
    const fixture = createFixture({ exists: { ok: true, value: true } });
    const result = await fixture.service.create({ email: " PERSON@example.com ", password: rawPassword });

    assert.equal(result.ok, false);
    // Task #101: the duplicate path now hashes once, matching the cost of a
    // first-time registration, so response timing cannot disclose that the
    // identity is already registered. No record is written either way.
    assert.equal(fixture.hashCalls, 1);
    assert.equal(fixture.records.length, 0);
    if (!result.ok) {
      assert.equal(result.error.code, "already-exists");
      assert.equal(result.error.message.includes("person@example.com"), false);
    }
  });

  it("maps hashing failures to a sanitized result and rejects a plain-text hash", async () => {
    const thrown = createFixture({ hashThrows: true });
    const failed = await thrown.service.create({ email: "person@example.com", password: rawPassword });
    const plain = createFixture({ hash: { ok: true, passwordHash: rawPassword } });
    const plainResult = await plain.service.create({ email: "person@example.com", password: rawPassword });

    assert.equal(failed.ok, false);
    assert.equal(plainResult.ok, false);
    if (!failed.ok) assert.equal(failed.error.message.includes("private hashing detail"), false);
    assert.equal(thrown.records.length + plain.records.length, 0);
  });

  it("maps lookup and persistence failures without exposing internal details", async () => {
    const lookup = createFixture({ existsThrows: true });
    const lookupResult = await lookup.service.create({ email: "person@example.com", password: rawPassword });
    const write = createFixture({ created: { ok: false, issue: { code: "storage-failure" } } });
    const writeResult = await write.service.create({ email: "person@example.com", password: rawPassword });

    assert.equal(lookupResult.ok, false);
    assert.equal(writeResult.ok, false);
    if (!lookupResult.ok) assert.equal(lookupResult.error.message.includes("private storage detail"), false);
    assert.equal(write.records.length, 1);
    assert.equal(JSON.stringify(write.records).includes(rawPassword), false);
  });

  it("handles an atomic duplicate discovered during repository creation", async () => {
    const fixture = createFixture({ created: { ok: false, issue: { code: "already-exists" } } });
    const result = await fixture.service.create({ email: "person@example.com", password: rawPassword });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "already-exists");
  });
});

describe("registration identity uniqueness (US-03)", () => {
  it("maps an atomic uniqueness conflict to the same non-disclosing response", async () => {
    const fixture = createFixture({ created: { ok: false, issue: { code: "already-exists" } } });
    const result = await fixture.service.create({ email: "person@example.com", password: rawPassword });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "already-exists");
      assert.equal(result.error.message, "An account could not be created with these details.");
      assert.equal(result.error.message.includes("person@example.com"), false);
    }
  });

  it("allows only one concurrent create when the repository enforces atomic uniqueness", async () => {
    const records = new Map<string, NewAccountRecord>();
    const dependencies: AccountCreationDependencies = {
      repository: {
        async existsByEmail(email) { return { ok: true, value: records.has(email) }; },
        async create(record) {
          if (records.has(record.account.email)) return { ok: false, issue: { code: "already-exists" } };
          records.set(record.account.email, record);
          return { ok: true, value: record.account };
        },
      },
      passwordHasher: { async hash() { return { ok: true, passwordHash: "salted-hash" }; } },
      createAccountId: (() => { let id = 0; return () => `account-${++id}`; })(),
      now: () => "2026-09-28T00:00:00Z",
    };
    const service = createAccountService(dependencies);
    const results = await Promise.all([
      service.create({ email: "person@example.com", password: rawPassword }),
      service.create({ email: " PERSON@example.com ", password: rawPassword }),
    ]);
    assert.equal(results.filter(result => result.ok).length, 1);
    assert.equal(records.size, 1);
    const duplicate = results.find(result => !result.ok);
    assert.ok(duplicate && !duplicate.ok);
    if (duplicate && !duplicate.ok) assert.equal(duplicate.error.code, "already-exists");
  });
});

describe("duplicate registration safety (Task #101)", () => {
  it("does the same expensive work whether or not the identity is already registered", async () => {
    // The non-disclosing message is only meaningful if the response does not leak
    // the same fact some other way. Hashing cost is used here as the deterministic
    // stand-in for elapsed time: a wall-clock assertion would be flaky, but the
    // number of scrypt operations is an exact proxy for how much work the caller
    // made an attacker pay to distinguish the two outcomes.
    const firstTime = createFixture();
    const alreadyRegistered = createFixture({ exists: { ok: true, value: true } });

    const created = await firstTime.service.create({ email: "person@example.com", password: rawPassword });
    const duplicate = await alreadyRegistered.service.create({ email: "person@example.com", password: rawPassword });

    assert.equal(created.ok, true);
    assert.equal(duplicate.ok, false);
    assert.equal(firstTime.hashCalls, alreadyRegistered.hashCalls);
    assert.equal(alreadyRegistered.hashCalls, 1);
  });

  it("creates no second account and keeps the duplicate message non-disclosing", async () => {
    const fixture = createFixture({ exists: { ok: true, value: true } });
    const result = await fixture.service.create({ email: " PERSON@Example.com ", password: rawPassword });

    assert.equal(fixture.records.length, 0);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "already-exists");
      assert.equal(result.error.message, "An account could not be created with these details.");
      assert.equal(result.error.message.includes("person@example.com"), false);
      assert.equal(result.error.message.toLowerCase().includes("already"), false);
      assert.equal(result.error.message.toLowerCase().includes("exists"), false);
      assert.equal(result.error.message.toLowerCase().includes("registered"), false);
    }
  });

  it("still rejects malformed input without paying the hashing cost", async () => {
    // Timing parity applies to the duplicate path only. Invalid input carries no
    // information about whether an account exists, so it still short-circuits.
    const fixture = createFixture({ exists: { ok: true, value: true } });
    const result = await fixture.service.create({ email: "  ", password: rawPassword });

    assert.equal(result.ok, false);
    assert.equal(fixture.hashCalls, 0);
    assert.equal(fixture.records.length, 0);
  });
});
