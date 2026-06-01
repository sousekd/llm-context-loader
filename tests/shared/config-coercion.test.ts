/** Verifies YAML scalar preprocessors used by config schemas. */
import { describe, expect, it } from "vitest";

import { booleanStringAsBooleanOrUndefined, emptyStringAsUndefined } from "../../src/shared/config-coercion.js";

describe("config coercion helpers", () => {
  it("treats blank strings as missing", () => {
    expect(emptyStringAsUndefined("")).toBeUndefined();
    expect(emptyStringAsUndefined("   ")).toBeUndefined();
  });

  it("leaves nonblank and nonstring values unchanged", () => {
    expect(emptyStringAsUndefined("0")).toBe("0");
    expect(emptyStringAsUndefined(0)).toBe(0);
    expect(emptyStringAsUndefined(undefined)).toBeUndefined();
  });

  it("parses strict boolean strings", () => {
    expect(booleanStringAsBooleanOrUndefined("")).toBeUndefined();
    expect(booleanStringAsBooleanOrUndefined(" TRUE ")).toBe(true);
    expect(booleanStringAsBooleanOrUndefined("false")).toBe(false);
  });

  it("leaves invalid boolean strings for schema errors", () => {
    expect(booleanStringAsBooleanOrUndefined("yes")).toBe("yes");
    expect(booleanStringAsBooleanOrUndefined("0")).toBe("0");
    expect(booleanStringAsBooleanOrUndefined(false)).toBe(false);
    expect(booleanStringAsBooleanOrUndefined(undefined)).toBeUndefined();
  });
});
