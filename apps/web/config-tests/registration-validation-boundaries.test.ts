/**
 * @file config-tests/registration-validation-boundaries.test.ts
 *
 * Task #99 — registration validation at its boundaries.
 *
 * The issue asks for valid and invalid field **combinations**, proving empty
 * fields, malformed email, and weak passwords are rejected **consistently**
 * across client and server. The suites added by #95, #97, and #98 cover the
 * single-field cases and a handful of hand-picked pairs; none walks the
 * combinations, and none asserts that every layer agrees about *which* fields
 * failed rather than merely that something failed.
 *
 * This suite adds the combination matrix and the numeric boundary's third side,
 * and pins the two edges of the documented contract that are easy to break
 * silently: there is **no maximum** password length, and a password of exactly
 * the minimum length is accepted even if every character is whitespace.
 *
 * That second edge is recorded as current behaviour on purpose. The shared
 * policy documents no composition requirement, so a 12-space password is valid
 * by contract. Tightening it would be a new rule and belongs to its own task;
 * what this suite does is make the existing behaviour explicit so a future
 * change to the policy is deliberate rather than accidental.
 *
 * Every case is checked at the boundary that owns it:
 *  - the shared policy, for the rule itself;
 *  - the account service, for the rejection the service produces;
 *  - the HTTP endpoint, for what a caller is actually told;
 *  - the form's feedback mapping, for what the user is shown.
 * Agreement between the last two is #99's "consistently".
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MIN_REGISTRATION_PASSWORD_LENGTH, validateRegistration } from "../account";
import { createAccountComposition } from "../account/composition";
import { resetAccountComposition, setAccountComposition } from "../account/application";
import { toRegistrationFeedback, validateRegistrationFields } from "../app/register/registration-form-rules";
import { POST as registerAccount } from "../app/api/register/route";

const strongPassword = "correct horse battery staple";

type Field = "email" | "password";

interface ServerError {
  code?: string;
  message?: string;
  issues?: Array<{ field?: string; code?: string; message?: string }>;
}
interface ResponseBody {
  ok?: boolean;
  error?: ServerError;
}

let uniquePart = 0;
function uniqueEmail(prefix: string): string {
  uniquePart += 1;
  return `${prefix}${uniquePart}@example.com`;
}

function policyFields(email: string, password: string): Field[] {
  return validateRegistration({ email, password })
    .issues.map((issue) => issue.field)
    .filter((field): field is Field => field === "email" || field === "password");
}

async function submitToServer(email: string, password: string): Promise<{ status: number; body: ResponseBody }> {
  const response = await registerAccount(
    new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  return { status: response.status, body: (await response.json()) as ResponseBody };
}

describe("registration validation boundaries (Task #99)", () => {
  it("rejects every invalid field combination consistently across all four layers", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const validEmail = uniqueEmail("combo");
      const belowMinimum = "x".repeat(MIN_REGISTRATION_PASSWORD_LENGTH - 1);

      // email state, email, password, fields the email fails, fields the password fails.
      const matrix: Array<[string, string, string, Field[], Field[]]> = [
        ["valid", validEmail, strongPassword, [], []],
        ["valid", validEmail, belowMinimum, [], ["password"]],
        ["valid", validEmail, "", [], ["password"]],
        ["malformed", "not-an-address", strongPassword, ["email"], []],
        ["malformed", "not-an-address", belowMinimum, ["email"], ["password"]],
        ["malformed", "not-an-address", "", ["email"], ["password"]],
        ["empty", "", strongPassword, ["email"], []],
        ["empty", "", belowMinimum, ["email"], ["password"]],
        ["empty", "", "", ["email"], ["password"]],
      ];

      for (const [emailState, email, password, emailFails, passwordFails] of matrix) {
        const expected = [...emailFails, ...passwordFails].sort();
        const label = `${emailState} email + ${password === strongPassword ? "valid" : password === "" ? "empty" : "weak"} password`;

        // 1. the shared policy
        assert.deepEqual(policyFields(email, password), expected, `policy disagrees for ${label}`);

        // 2. the account service, which must not create anything
        const service = await composition.create({ email, password });
        if (expected.length > 0) {
          assert.equal(service.ok, false, `service must reject ${label}`);
        } else {
          assert.equal(service.ok, true, `service must accept ${label}`);
        }

        // 3. the HTTP endpoint. The submitted address must preserve the row's
        // email *state* — substituting a valid one would turn a malformed row
        // into a duplicate or a pass — while staying unique so the service call
        // above cannot already have created it.
        uniquePart += 1;
        const submissionEmail =
          emailState === "empty" ? "" : emailState === "malformed" ? `no-at-sign-${uniquePart}` : `combo-valid-${uniquePart}@example.com`;
        const http = await submitToServer(submissionEmail, password);
        if (expected.length > 0) {
          assert.equal(http.status, 400, `endpoint must reject ${label}`);
          assert.equal(http.body.error?.code, "invalid-input", `endpoint must report invalid-input for ${label}`);
          const serverFields = (http.body.error?.issues ?? [])
            .map((issue) => issue.field)
            .filter((field): field is Field => field === "email" || field === "password")
            .sort();
          assert.deepEqual(serverFields, expected, `endpoint must name the same fields for ${label}`);

          // 4. what the form would show the user
          const feedback = toRegistrationFeedback(http.body);
          assert.equal(feedback.ok, false);
          if (!feedback.ok) {
            assert.deepEqual(
              Object.keys(feedback.fieldErrors ?? {}).sort(),
              expected,
              `the form must blame the same fields for ${label}`,
            );
          }
        } else {
          assert.equal(http.status, 201, `endpoint must accept ${label}`);
        }
      }

      // Exactly one row is valid, and it reaches the store twice: once through
      // the service directly and once through the endpoint, on different
      // identities. Every other row must have created nothing.
      assert.equal(composition.persistence.accountCount, 2);
    } finally {
      resetAccountComposition();
    }
  });

  it("treats empty and whitespace-only email alike as a missing required field", () => {
    for (const email of ["", " ", "   ", "\t", "\n", " \t\n "]) {
      assert.deepEqual(
        policyFields(email, strongPassword),
        ["email"],
        `${JSON.stringify(email)} must be reported as required, not as a format error`,
      );
    }
    assert.deepEqual(validateRegistration({ email: "   ", password: strongPassword }).issues[0].code, "required");
  });

  it("accepts boundary - 0, boundary and boundary + 1 of the password minimum", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const minimum = MIN_REGISTRATION_PASSWORD_LENGTH;
      const expectations: Array<[string, boolean]> = [
        ["x".repeat(minimum - 2), false],
        ["x".repeat(minimum - 1), false],
        ["x".repeat(minimum), true],
        ["x".repeat(minimum + 1), true],
      ];

      for (const [password, accepted] of expectations) {
        assert.equal(
          validateRegistration({ email: "user@example.com", password }).ok,
          accepted,
          `${password.length} characters must be ${accepted ? "accepted" : "rejected"}`,
        );
        assert.equal(policyFields("user@example.com", password).includes("password"), !accepted);

        const http = await submitToServer(uniqueEmail(`len${password.length}`), password);
        assert.equal(
          http.status,
          accepted ? 201 : 400,
          `the endpoint must agree for a ${password.length}-character password`,
        );
      }
    } finally {
      resetAccountComposition();
    }
  });

  it("imposes no maximum password length, as the policy documents", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      const veryLong = "x".repeat(2048);
      assert.equal(validateRegistration({ email: "user@example.com", password: veryLong }).ok, true);

      const email = uniqueEmail("verylong");
      const http = await submitToServer(email, veryLong);
      assert.equal(http.status, 201, "an over-long password must not be silently truncated or rejected");

      const stored = await composition.persistence.getCredentialByEmail(email);
      assert.ok(stored, "the account must exist");
    } finally {
      resetAccountComposition();
    }
  });

  it("accepts a minimum-length password made only of whitespace, as the contract allows", () => {
    // The shared policy defines a length floor and no composition requirement.
    // This is the documented current behaviour, pinned deliberately: a future
    // tightening must be a conscious change, not an accident.
    const spaces = " ".repeat(MIN_REGISTRATION_PASSWORD_LENGTH);
    assert.equal(validateRegistration({ email: "user@example.com", password: spaces }).ok, true);

    // One character fewer is still rejected, so the length rule still applies.
    assert.deepEqual(
      policyFields("user@example.com", " ".repeat(MIN_REGISTRATION_PASSWORD_LENGTH - 1)),
      ["password"],
    );
  });

  it("normalizes surrounding whitespace on the email but never inside it", () => {
    const padded = `  user@example.com \t `;
    assert.equal(validateRegistration({ email: padded, password: strongPassword }).ok, true);

    // The same padding around a malformed address is still malformed.
    assert.deepEqual(policyFields("  not-an-address  ", strongPassword), ["email"]);
    for (const internal of ["us er@example.com", "user@exa mple.com", "user name@example.com"]) {
      assert.deepEqual(policyFields(internal, strongPassword), ["email"], `${internal} must be rejected`);
    }
  });

  it("keeps the valid boundary case fully working end to end", async () => {
    const composition = createAccountComposition();
    setAccountComposition(composition);
    try {
      // Everything exactly at its limit, at once.
      const email = `  Boundary${uniquePart}@Example.COM  `;
      const password = "y".repeat(MIN_REGISTRATION_PASSWORD_LENGTH);

      assert.equal(validateRegistration({ email, password }).ok, true);
      assert.deepEqual(validateRegistrationFields({ email, password }), {}, "the form must allow this through");

      const http = await submitToServer(email, password);
      assert.equal(http.status, 201);

      const created = composition.persistence.getAccountByEmail(email);
      assert.ok(created, "the account must be stored under the normalized identity");
      assert.equal(created?.email, `boundary${uniquePart}@example.com`);
    } finally {
      resetAccountComposition();
    }
  });
});
