import { describe, expect, it, vi } from "vitest";
import { installPdfBrowserCompatibility } from "./pdf-browser-compat";

describe("PDF browser compatibility", () => {
  it("adds Promise.withResolvers when Safari does not provide it", async () => {
    const PromiseWithoutResolvers = Promise.bind(null) as PromiseConstructor & {
      withResolvers?: typeof Promise.withResolvers;
    };
    const scope = { Promise: PromiseWithoutResolvers, Symbol, ReadableStream: undefined };

    expect(scope.Promise.withResolvers).toBeUndefined();
    installPdfBrowserCompatibility(scope);
    const deferred = scope.Promise.withResolvers!<string>();
    deferred.resolve("ready");

    await expect(deferred.promise).resolves.toBe("ready");
  });

  it("adds async iteration to ReadableStream-like objects", async () => {
    const chunks = ["one", "two"];
    const releaseLock = vi.fn();
    const prototype = {
      getReader() {
        return {
          async read() {
            const value = chunks.shift();
            return value ? { done: false as const, value } : { done: true as const, value: undefined };
          },
          async cancel() {},
          releaseLock,
        };
      },
    };
    const scope = { Promise, Symbol, ReadableStream: { prototype } };
    installPdfBrowserCompatibility(scope);

    const values: string[] = [];
    for await (const value of Object.create(prototype) as AsyncIterable<string>) values.push(value);

    expect(values).toEqual(["one", "two"]);
    expect(releaseLock).toHaveBeenCalledTimes(1);
  });
});
