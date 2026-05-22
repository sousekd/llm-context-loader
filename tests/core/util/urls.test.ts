import { describe, expect, it } from "vitest";

import { joinUrl, validateHttpUrl } from "../../../src/core/util/urls.js";

describe("urls", () => {
  it("returns normalized HTTP and HTTPS URLs", () => {
    expect(validateHttpUrl("https://example.com/path")).toBe("https://example.com/path");
    expect(validateHttpUrl("http://example.com")).toBe("http://example.com/");
  });

  it("throws invalid_url for malformed URLs", () => {
    expect(() => validateHttpUrl("not a url")).toThrow(expect.objectContaining({ code: "invalid_url", statusCode: 400 }));
  });

  it.each(["ftp://example.com", "javascript:alert(1)", "data:text/plain,hello", "file:///tmp/a"])(
    "throws unsupported_url_scheme for %s",
    (url) => {
      expect(() => validateHttpUrl(url)).toThrow(
        expect.objectContaining({ code: "unsupported_url_scheme", statusCode: 400 })
      );
    }
  );

  it("joins base URLs and paths with one slash", () => {
    expect(joinUrl("https://api.example.com/", "/v1/chat")).toBe("https://api.example.com/v1/chat");
    expect(joinUrl("https://api.example.com", "v1/chat")).toBe("https://api.example.com/v1/chat");
  });

  it("preserves query strings on joined paths", () => {
    expect(joinUrl("https://api.example.com/", "/v1/chat?mode=test")).toBe(
      "https://api.example.com/v1/chat?mode=test"
    );
  });
});

