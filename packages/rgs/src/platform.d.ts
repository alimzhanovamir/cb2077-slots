// The RGS runs both in Node.js and in browsers, so it compiles without Node or DOM typings.
// These are the only platform APIs it may use; both runtimes provide them as globals.

declare const crypto: {
  getRandomValues<T extends Uint8Array | Uint32Array>(array: T): T;
};

declare function setTimeout(callback: () => void, ms: number): unknown;
