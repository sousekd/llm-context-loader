/** Verifies shared HTTP URL validation and URL joining behavior. */
import { describe, expect, it } from "vitest";

import { ClientError } from "../../src/shared/errors.js";
import { joinUrl, parseHttpUrl } from "../../src/shared/urls.js";

describe("parseHttpUrl", () => {
  it("normalizes absolute HTTP and HTTPS URLs", () => {
    expect(parseHttpUrl("http://example.com/path")).toBe("http://example.com/path");
    expect(parseHttpUrl("https://example.com/path")).toBe("https://example.com/path");
  });

  it("rejects relative URLs as caller errors", () => {
    expect(() => parseHttpUrl("/relative")).toThrow(ClientError);
    expect(() => parseHttpUrl("/relative")).toThrow("URL must be absolute");
  });

  it("rejects non-HTTP protocols as caller errors", () => {
    expect(() => parseHttpUrl("ftp://example.com")).toThrow(ClientError);
    expect(() => parseHttpUrl("ftp://example.com")).toThrow("URL must use http or https");
  });
});

describe("joinUrl", () => {
  it("joins paths without dropping the base pathname", () => {
    expect(joinUrl("https://example.com/api", "/v2/scrape")).toBe("https://example.com/api/v2/scrape");
    expect(joinUrl("https://example.com/api/", "v2/scrape")).toBe("https://example.com/api/v2/scrape");
  });
});
