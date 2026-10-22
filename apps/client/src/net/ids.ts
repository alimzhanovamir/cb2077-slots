import { RequestId } from "@cb2077/shared";

/**
 * Random request id. Uses `crypto.getRandomValues` because `crypto.randomUUID` is missing
 * outside secure contexts (e.g. the game opened from a phone via http://192.168.x.x).
 */
export function newRequestId(): RequestId {
  const bytes = crypto.getRandomValues(new Uint8Array(12));

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return RequestId.parse(`q-${hex}`);
}
