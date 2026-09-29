import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAuthorizationService } from "../authorization/service";
import type { AccountOwnedResource, AuthorizationDecision } from "../authorization/types";

function resource(accountId: string): AccountOwnedResource {
  return { accountId, resourceType: "account", resourceId: accountId };
}

describe("resource ownership authorization (Tasks #118–#120)", () => {
  const service = createAuthorizationService();

  it("allows an authenticated actor to access their own resource", () => {
    const decision: AuthorizationDecision = service.require("account-1", resource("account-1"));
    assert.deepEqual(decision, { allowed: true, actor: "account-1" });
  });

  it("rejects an unauthenticated actor", () => {
    const decision = service.require(null, resource("account-1"));
    assert.equal(decision.allowed, false);
    if (!decision.allowed) assert.equal(decision.code, "unauthenticated");
  });

  it("rejects a different account attempting to access another's resource", () => {
    const decision = service.require("account-2", resource("account-1"));
    assert.equal(decision.allowed, false);
    if (!decision.allowed) assert.equal(decision.code, "forbidden");
  });
});