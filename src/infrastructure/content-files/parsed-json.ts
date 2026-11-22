import type { Result } from "../../domain/result.ts";

export const parsedJson = (request: { readonly text: string }): Result<unknown, string> => {
  try {
    const parsed: unknown = JSON.parse(request.text);
    return { outcome: "ok", value: parsed };
  } catch (thrown) {
    return {
      outcome: "failed",
      error: thrown instanceof Error ? thrown.message : String(thrown),
    };
  }
};
