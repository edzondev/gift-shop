import type { Context } from "hono";
import * as v from "valibot";
import { type ApiEnv, validationError } from "./errors";

export function issuePath(issue: v.BaseIssue<unknown>): string {
  const keys: string[] = [];
  for (const item of issue.path ?? []) {
    if (typeof item.key === "string" || typeof item.key === "number") keys.push(String(item.key));
  }
  return keys.join(".");
}

export function validationHook<Schema extends v.GenericSchema>(schema: Schema) {
  return (value: unknown, c: Context<ApiEnv>) => {
    const parsed = v.safeParse(schema, value);
    if (!parsed.success) {
      const issues = parsed.issues.map((issue) => ({
        path: issuePath(issue),
        message: issue.message,
      }));
      return c.json(validationError(issues), 422);
    }
    return parsed.output;
  };
}
