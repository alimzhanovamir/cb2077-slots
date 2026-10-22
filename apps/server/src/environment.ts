import { z } from "zod";

const Environment = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
  /** Starting balance of a new session, in cents. */
  START_BALANCE: z.coerce.number().int().nonnegative().default(100_000),
  /** Minutes a disconnected session is kept. */
  SESSION_TTL_MIN: z.coerce.number().positive().default(30),
});

export type Environment = z.infer<typeof Environment>;

/** Reads and validates environment variables; exits on invalid values (fail fast). */
export function readEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  const result = Environment.safeParse(source);

  if (!result.success) {
    console.error("Invalid environment:", z.prettifyError(result.error));
    process.exit(1);
  }

  return result.data;
}
