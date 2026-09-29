import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AccountWriteLock } from "../account/lock";
import { InMemorySessionRepository } from "../session/repository";
import { createSessionService } from "../session/service";
import type { Session, SessionEvaluation } from "../session/types";

const FIXED_NOW = "2026-09-28T12:00:00Z";
const ONE_HOUR_MS = 60 * 60 * 1000;

/** Repository whose evaluation clock can be advanced independently. */
class AdvancingSessionRepository extends InMemorySessionRepository {
  private evaluationClock: () => string = () => FIXED_NOW;

  setClock(iso: string): void {
    this.evaluationClock = () => iso;
  }

  async getValid(id: string): Promise<SessionEvaluation> {
    return super.getValid(id, this.evaluationClock);
  }
}

describe("session lifecycle (Tasks #106–#117)", () => {
  it("creates a session with a stable account reference and future expiry", async () => {
    const repository = new InMemorySessionRepository();
    const service = createSessionService({
      repository,
      createSessionId: () => "session-1",
      now: () => FIXED_NOW,
      sessionTtlMs: ONE_HOUR_MS,
    });

    const created = await service.create("account-1");
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const session: Session = created.value;
    assert.equal(session.id, "session-1");
    assert.equal(session.accountId, "account-1");
    assert.equal(session.createdAt, FIXED_NOW);
    assert.equal(session.expiresAt, "2026-09-28T13:00:00.000Z");
    assert.equal("password" in session, false);
    assert.equal("passwordHash" in session, false);
  });

  it("evaluates an active session as active", async () => {
    const repository = new InMemorySessionRepository();
    const service = createSessionService({
      repository,
      createSessionId: () => "session-1",
      now: () => FIXED_NOW,
      sessionTtlMs: ONE_HOUR_MS,
    });
    await service.create("account-1");

    const evaluation: SessionEvaluation = await service.evaluate("session-1");
    assert.equal(evaluation.status, "active");
    assert.ok(evaluation.session);
    if (evaluation.session) assert.equal(evaluation.session.accountId, "account-1");
  });

  it("rejects an unknown session as revoked", async () => {
    const repository = new InMemorySessionRepository();
    const service = createSessionService({
      repository,
      createSessionId: () => "session-1",
      now: () => FIXED_NOW,
      sessionTtlMs: ONE_HOUR_MS,
    });

    const evaluation = await service.evaluate("missing");
    assert.equal(evaluation.status, "revoked");
    assert.equal(evaluation.session, null);
  });

  it("marks a session expired when the evaluation clock advances past expiry", async () => {
    const repository = new AdvancingSessionRepository();
    const service = createSessionService({
      repository,
      createSessionId: () => "session-1",
      now: () => FIXED_NOW,
      sessionTtlMs: ONE_HOUR_MS,
    });
    await service.create("account-1");

    repository.setClock("2026-09-28T14:00:00Z");
    const evaluation = await service.evaluate("session-1");
    assert.equal(evaluation.status, "expired");
    assert.ok(evaluation.session);
  });

  it("logout destroys a session and reports whether one was found", async () => {
    const repository = new InMemorySessionRepository();
    const service = createSessionService({
      repository,
      createSessionId: () => "session-1",
      now: () => FIXED_NOW,
      sessionTtlMs: ONE_HOUR_MS,
    });
    await service.create("account-1");

    const destroyed = await service.logout("session-1");
    assert.equal(destroyed.ok, true);
    if (destroyed.ok) assert.equal(destroyed.value, true);

    const missing = await service.logout("session-1");
    assert.equal(missing.ok, true);
    if (missing.ok) assert.equal(missing.value, false);
  });

  it("logoutAllForAccount revokes every session for that account", async () => {
    const lock = new AccountWriteLock();
    const repository = new InMemorySessionRepository({ lock });
    const service = createSessionService({
      repository,
      createSessionId: (() => {
        let id = 0;
        return () => `session-${++id}`;
      })(),
      now: () => FIXED_NOW,
      sessionTtlMs: ONE_HOUR_MS,
    });

    await service.create("account-1");
    await service.create("account-1");
    await service.create("account-2");

    const revoked = await service.logoutAllForAccount("account-1");
    assert.equal(revoked.ok, true);
    if (revoked.ok) assert.equal(revoked.value, 2);
    assert.equal(repository.size, 1);
  });
});