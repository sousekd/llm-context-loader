/** Verifies AsyncLocalStorage request-context scoping helpers. */
import { describe, expect, it } from "vitest";

import { InternalError } from "../../src/shared/errors.js";
import { getRequestContext, runWithRequestContext, withChildRequestContext } from "../../src/shared/request-context.js";

describe("request context", () => {
  it("runs callbacks inside an isolated request scope", () => {
    const outside = getRequestContext();
    const inside = runWithRequestContext({ request_id: "r1" }, () => getRequestContext());

    expect(outside).toBeUndefined();
    expect(inside).toEqual({ request_id: "r1" });
    expect(getRequestContext()).toBeUndefined();
  });

  it("merges child run fields over the active request scope", () => {
    const child = runWithRequestContext({ request_id: "r1" }, () =>
      withChildRequestContext({ run_id: "run1", url: "https://example.com/" }, () => getRequestContext())
    );

    expect(child).toEqual({ request_id: "r1", run_id: "run1", url: "https://example.com/" });
  });

  it("rejects child scopes without a parent request scope", () => {
    expect(() => withChildRequestContext({ run_id: "run1" }, () => undefined)).toThrow(InternalError);
    expect(() => withChildRequestContext({ run_id: "run1" }, () => undefined)).toThrow(
      "withChildRequestContext requires an active request-context scope"
    );
  });
});
