/**
 * @file config-tests/authorization.test.ts
 *
 * Task #118 — the resource ownership authorization rule.
 *
 * These are focused tests for the **primitive**. They deliberately do not
 * reproduce the HTTP-boundary coverage in `account-management-api.test.ts`,
 * which drives the real routes against real sessions and is the end-to-end
 * proof; that suite is referenced from `authorization/README.md` instead.
 *
 * The cases below cover what the primitive uniquely has to establish, and one
 * of them closes a real gap in the pre-existing three. Those all built their
 * resource with `resourceId === accountId`, which means every one of them would
 * still pass if the implementation compared `resource.resourceId` instead of
 * `resource.accountId` — the two were indistinguishable. Ownership must be
 * decided by the owner's account ID, never by the resource identifier the client
 * selected, so `describe` below pins that distinction explicitly.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAuthorizationService } from "../authorization/service";
import type { AccountOwnedResource, AuthorizationDecision } from "../authorization/types";

function resource(accountId: string): AccountOwnedResource {
  return { accountId, resourceType: "account", resourceId: accountId };
}

/** A resource whose identifier deliberately differs from its owner's account ID. */
function resourceWithDistinctId(accountId: string, resourceId: string): AccountOwnedResource {
  return { accountId, resourceType: "account", resourceId };
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

/**
 * Client-identifier independence (Task #118).
 *
 * The acceptance criterion is that ownership is "checked independently of
 * client-supplied identifiers". At the primitive level that means the comparison
 * is against `resource.accountId` and nothing else: the `resourceId` a client
 * selected, and `resourceType`, must be incapable of influencing it.
 */
describe("ownership is decided by the owner's account ID (Task #118)", () => {
  const service = createAuthorizationService();

  it("allows the owner when the resource identifier differs from the account ID", () => {
    // Ownership holds because the *actor* is the owner, not because some string
    // matched.
    const decision = service.require("account-1", resourceWithDistinctId("account-1", "resource-xyz"));
    assert.deepEqual(decision, { allowed: true, actor: "account-1" });
  });

  it("refuses an actor who merely matches the resource identifier", () => {
    // This is the substitution that would break the contract: an actor equal to
    // `resourceId` but not to the owner must still be forbidden. Without this
    // case an implementation comparing `resourceId` would pass every other test.
    const decision = service.require("resource-xyz", resourceWithDistinctId("account-1", "resource-xyz"));
    assert.equal(decision.allowed, false, "matching the resource identifier must not grant access");
    if (!decision.allowed) assert.equal(decision.code, "forbidden");
  });

  it("gives the same answer regardless of the resource type or identifier", () => {
    // `resourceType` is carried for the caller's benefit and must not change the
    // decision, or a future resource type could accidentally weaken the rule.
    const asAccount = service.require("account-2", { accountId: "account-1", resourceType: "account", resourceId: "account-1" });
    const asSomethingElse = service.require("account-2", { accountId: "account-1", resourceType: "portfolio", resourceId: "account-1" });
    assert.deepEqual(asSomethingElse, asAccount);
  });

  it("cannot be influenced by any value it does not read", () => {
    // The primitive takes exactly two arguments and returns exactly one decision.
    // Asserting the shape here documents the separation that keeps it from
    // acquiring a request, a repository, or a session.
    assert.equal(service.require.length, 2, "require must take only an actor and a resource");
    const decision = service.require("account-1", resource("account-1"));
    assert.deepEqual(Object.keys(decision).sort(), ["actor", "allowed"]);
  });
});