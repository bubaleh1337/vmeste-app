type WithResolvers = <T>() => {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

type Reader<T> = {
  read: () => Promise<ReadableStreamReadResult<T>>;
  cancel: (reason?: unknown) => Promise<void>;
  releaseLock: () => void;
};

type Stream<T> = { getReader: () => Reader<T> };

type CompatibilityScope = {
  Promise: PromiseConstructor & { withResolvers?: WithResolvers };
  Symbol: SymbolConstructor;
  ReadableStream?: { prototype: Record<PropertyKey, unknown> };
};

export function installPdfBrowserCompatibility(
  scope = globalThis as unknown as CompatibilityScope,
) {
  if (typeof scope.Promise.withResolvers !== "function") {
    Object.defineProperty(scope.Promise, "withResolvers", {
      configurable: true,
      writable: true,
      value: function withResolvers<T>() {
        let resolve!: (value: T | PromiseLike<T>) => void;
        let reject!: (reason?: unknown) => void;
        const promise = new scope.Promise<T>((nextResolve, nextReject) => {
          resolve = nextResolve;
          reject = nextReject;
        });
        return { promise, resolve, reject };
      } satisfies WithResolvers,
    });
  }

  const asyncIterator = scope.Symbol.asyncIterator;
  const streamPrototype = scope.ReadableStream?.prototype;
  if (!asyncIterator || !streamPrototype || typeof streamPrototype[asyncIterator] === "function") {
    return;
  }

  Object.defineProperty(streamPrototype, asyncIterator, {
    configurable: true,
    writable: true,
    value: function readableStreamAsyncIterator<T>(this: Stream<T>) {
      const reader = this.getReader();
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        reader.releaseLock();
      };

      const iterator = {
        async next() {
          const result = await reader.read();
          if (result.done) release();
          return result;
        },
        async return(value?: T) {
          try {
            await reader.cancel();
          } finally {
            release();
          }
          return { done: true as const, value };
        },
        async throw(error?: unknown) {
          try {
            await reader.cancel(error);
          } finally {
            release();
          }
          throw error;
        },
      } as unknown as AsyncIterableIterator<T>;
      Object.defineProperty(iterator, asyncIterator, {
        value: () => iterator,
      });
      return iterator;
    },
  });
}
