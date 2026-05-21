import pLimit from "p-limit";
import { describe, expect, it } from "vitest";

import type { LlmChatResult } from "../../../src/core/ports/llm-provider.js";

import { LoadContextUseCase } from "../../../src/core/use-cases/load-context.js";
import {
    buildTestConfig,
    makeFetchProviderStub,
    makeLlmProviderStub,
    makeStage,
    makeTemplateRenderer,
    silentLogger
} from "../../helpers/index.js";

interface Deferred<T> {
    promise: Promise<T>;
    resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

function makeStartedGate(target: number) {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
        resolve = done;
    });
    return { promise, notify: (count: number) => { if (count === target) resolve(); } };
}

describe("LoadContextUseCase concurrency", () => {
    it("limits each URL's whole LLM workflow with one limiter slot", async () => {
        const config = buildTestConfig({ CLEAN_MIN_INPUT_CHARS: "1", SUMMARIZE_ENABLED: "false" });
        const templates = makeTemplateRenderer(config, { cleanUser: "URL={{url}} {{content}}" });
        const fetch = makeFetchProviderStub();
        const urls = ["https://a.example/", "https://b.example/", "https://c.example/"];
        const gates = new Map(urls.map((url) => [url, deferred<LlmChatResult>()]));
        const firstTwoStarted = makeStartedGate(2);
        const thirdStarted = makeStartedGate(3);
        const started: string[] = [];
        let inFlight = 0;
        let maxInFlight = 0;

        const llm = makeLlmProviderStub({
            chat: async (messages) => {
                const userMessage = messages.find((message) => message.role === "user")?.content ?? "";
                const url = urls.find((candidate) => userMessage.includes(candidate));
                if (!url) throw new Error("test setup: URL missing from prompt");
                started.push(url);
                inFlight += 1;
                maxInFlight = Math.max(maxInFlight, inFlight);
                firstTwoStarted.notify(started.length);
                thirdStarted.notify(started.length);
                const result = await gates.get(url)!.promise;
                inFlight -= 1;
                return result;
            }
        });

        const useCase = new LoadContextUseCase({
            config,
            logger: silentLogger(),
            limiters: { fetch: pLimit(10), llm: pLimit(2) },
            fetchProvider: fetch.provider,
            cleanStage: makeStage(config, templates, llm.provider),
            summarizeStage: makeStage(config, templates, llm.provider, { summarize: true }),
            llmProviderName: llm.provider.name,
            templateRenderer: templates
        });

        const all = Promise.all(urls.map((url) => useCase.loadOne(url)));
        await firstTwoStarted.promise;

        expect(inFlight).toBe(2);
        expect(started).toEqual(["https://a.example/", "https://b.example/"]);

        gates.get("https://a.example/")!.resolve({ text: "cleaned content body ".repeat(20), model: "m" });
        await thirdStarted.promise;

        expect(inFlight).toBe(2);
        expect(started).toEqual(["https://a.example/", "https://b.example/", "https://c.example/"]);

        gates.get("https://b.example/")!.resolve({ text: "cleaned content body ".repeat(20), model: "m" });
        gates.get("https://c.example/")!.resolve({ text: "cleaned content body ".repeat(20), model: "m" });
        await all;

        expect(maxInFlight).toBe(2);
    });
});
