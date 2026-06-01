/** Verifies body version storage and step effect application rules. */
import { describe, expect, it } from "vitest";

import { BodyStore } from "../../../src/core/pipeline/body.js";
import { applyStepEffects } from "../../../src/core/pipeline/effects.js";

describe("BodyStore", () => {
  it("tracks current body and immutable version snapshots", () => {
    const body = new BodyStore();

    body.append({ stepName: "fetch", content: "source", title: "Title" });
    body.append({ stepName: "clean", content: "clean", title: "Title" });
    const versions = body.versions();

    expect(body.current()).toEqual({ content: "clean", title: "Title" });
    expect(versions.map(version => version.stepName)).toEqual(["fetch", "clean"]);
    expect(versions).not.toBe(body.versions());
  });
});

describe("applyStepEffects", () => {
  it("applies body, signal, and artifact effects for ok results", () => {
    const state = { body: new BodyStore(), signals: new Map(), artifacts: new Map() };

    const summary = applyStepEffects(
      "fetch",
      {
        status: "ok",
        effects: {
          body: { content: "source" },
          signals: { "feature.enabled": true },
          artifacts: { "feature.payload": { value: 1 } }
        }
      },
      state
    );

    expect(summary).toEqual({ outputChars: 6, wroteBody: true });
    expect(state.body.current()).toEqual({ content: "source", title: undefined });
    expect(state.signals.get("feature.enabled")).toBe(true);
    expect(state.artifacts.get("feature.payload")).toEqual({ value: 1 });

    applyStepEffects(
      "clear",
      { status: "ok", effects: { signals: { "feature.enabled": null }, artifacts: { "feature.payload": null } } },
      state
    );

    expect(state.signals.has("feature.enabled")).toBe(false);
    expect(state.artifacts.has("feature.payload")).toBe(false);
  });

  it("applies body, signal, and artifact effects for failed results", () => {
    const state = { body: new BodyStore(), signals: new Map(), artifacts: new Map() };
    state.body.append({ stepName: "fetch", content: "source", title: "Title" });
    state.signals.set("feature.enabled", true);
    state.artifacts.set("feature.payload", { value: 1 });

    const summary = applyStepEffects(
      "rollback",
      {
        status: "failed",
        reason: "hallucinated_urls",
        effects: {
          body: { content: "source", title: "Title" },
          signals: { "feature.enabled": null },
          artifacts: { "feature.payload": null }
        }
      },
      state
    );

    expect(summary).toEqual({ outputChars: 6, wroteBody: true });
    expect(state.body.versions().map(version => version.stepName)).toEqual(["fetch", "rollback"]);
    expect(state.signals.has("feature.enabled")).toBe(false);
    expect(state.artifacts.has("feature.payload")).toBe(false);
  });

  it("ignores effects on skipped results", () => {
    const state = { body: new BodyStore(), signals: new Map(), artifacts: new Map() };

    const summary = applyStepEffects(
      "skip",
      {
        status: "skipped",
        reason: "no_body",
        effects: {
          body: { content: "ignored" },
          signals: { "feature.enabled": true },
          artifacts: { "feature.payload": { value: 1 } }
        }
      },
      state
    );

    expect(summary).toEqual({ wroteBody: false });
    expect(state.body.current()).toBeUndefined();
    expect(state.signals.has("feature.enabled")).toBe(false);
    expect(state.artifacts.has("feature.payload")).toBe(false);
  });
});
