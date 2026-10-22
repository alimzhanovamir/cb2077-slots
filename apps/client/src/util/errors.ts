/**
 * Rejection handler for promises nobody awaits: such an error is a bug, so it must not pass
 * silently.
 */
export function logUnexpectedError(error: unknown): void {
  console.error("Unexpected error:", error);
}
