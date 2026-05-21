import { describe, expect, it } from "vitest";

import { AppError, messageFromError, reasonFromError } from "../../../src/core/util/errors.js";

describe("errors", () => {
    it("constructs AppError with a stable code and default status", () => {
        const details = { upstream: "payload" };
        const error = new AppError("Failed", "provider_failed", undefined, details);

        expect(error).toMatchObject({ name: "AppError", message: "Failed", code: "provider_failed", statusCode: 500, details });
    });

    it("constructs AppError with an explicit status", () => {
        const error = new AppError("No", "unauthorized", 401);

        expect(error.statusCode).toBe(401);
    });

    it("returns AppError codes as diagnostic reasons", () => {
        expect(reasonFromError(new AppError("Bad URL", "invalid_url", 400))).toBe("invalid_url");
    });

    it("returns slugified Error messages as diagnostic reasons", () => {
        expect(reasonFromError(new Error("Context Length Exceeded!!!"))).toBe("context_length_exceeded");
    });

    it("bounds long diagnostic reasons", () => {
        const reason = reasonFromError(new Error("x".repeat(80)));

        expect(reason).toHaveLength(40);
    });

    it("returns unknown_error for non-Error values", () => {
        expect(reasonFromError("nope")).toBe("unknown_error");
    });

    it("returns Error messages for display", () => {
        expect(messageFromError(new Error("boom"))).toBe("boom");
    });

    it("returns stringified non-Error values for display", () => {
        expect(messageFromError(42)).toBe("42");
    });
});
