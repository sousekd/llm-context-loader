import { describe, expect, it } from "vitest";

import { TemplateRenderer, type TemplateLoader } from "../../../src/core/cleanup/templates.js";
import { buildTestConfig, makeFooterInfo } from "../../helpers/index.js";

function makeRenderer(templates: Record<string, string>) {
  const config = buildTestConfig();
  const loaded: string[] = [];
  const loader: TemplateLoader = async (path) => {
    loaded.push(path);
    const filename = path.replace(/\\/g, "/").split("/").at(-1) ?? path;
    return templates[filename] ?? "missing {{content}}";
  };
  return { config, loaded, renderer: new TemplateRenderer(config, loader) };
}

describe("TemplateRenderer", () => {
  it("renders stage templates with the supplied view", async () => {
    const { config, renderer } = makeRenderer({
      "clean.system.md": "clean system {{url}}",
      "clean.user.md": "clean user {{title}} {{content}}",
      "summarize.system.md": "sum system {{url}}",
      "summarize.user.md": "sum user {{title}} {{content}}"
    });
    const view = { url: "https://example.com/", title: "Example", content: "Body" };

    await expect(renderer.render(config.CLEAN_SYSTEM_TEMPLATE, view)).resolves.toBe("clean system https://example.com/");
    await expect(renderer.render(config.CLEAN_USER_TEMPLATE, view)).resolves.toBe("clean user Example Body");
    await expect(renderer.render(config.SUMMARIZE_SYSTEM_TEMPLATE, view)).resolves.toBe("sum system https://example.com/");
    await expect(renderer.render(config.SUMMARIZE_USER_TEMPLATE, view)).resolves.toBe("sum user Example Body");
  });

  it("renders the footer template from footer variables", async () => {
    const { renderer } = makeRenderer({ "footer.md": "returned={{returned}} source={{source_url}} fetch={{fetch_status}}" });

    const footer = await renderer.renderFooter(makeFooterInfo({ returned: "source", sourceUrl: "https://example.com/a" }));

    expect(footer).toBe("returned=source source=https://example.com/a fetch=ok");
  });

  it("loads each template file once", async () => {
    const { config, loaded, renderer } = makeRenderer({ "clean.user.md": "{{content}}" });

    await renderer.render(config.CLEAN_USER_TEMPLATE, { content: "one" });
    await renderer.render(config.CLEAN_USER_TEMPLATE, { content: "two" });

    expect(loaded.filter((path) => path.endsWith(config.CLEAN_USER_TEMPLATE))).toHaveLength(1);
  });

  it("passes unescaped text through Mustache", async () => {
    const { config, renderer } = makeRenderer({ "clean.user.md": "{{content}}" });

    const output = await renderer.render(config.CLEAN_USER_TEMPLATE, { content: "<tag>&value" });

    expect(output).toBe("<tag>&value");
  });
});

