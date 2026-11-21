import { z } from "zod";

export const resolvedConfigSchema = z.union([
  z.undefined(),
  z.looseObject({
    rules: z
      .record(
        z.string(),
        z.tuple([z.union([z.literal(0), z.literal(1), z.literal(2)])], z.unknown()),
      )
      .optional(),
    plugins: z.record(z.string(), z.unknown()).optional(),
    language: z.unknown().optional(),
    processor: z.unknown().optional(),
    languageOptions: z.looseObject({ parser: z.unknown().optional() }).optional(),
  }),
]);

export type ResolvedConfig = z.output<typeof resolvedConfigSchema>;

export type RuleState =
  | { readonly state: "file-ignored" }
  | { readonly state: "rule-absent" }
  | { readonly state: "configured"; readonly severity: 0 | 1 | 2; readonly options: readonly unknown[] };

export const ruleStateOf = (request: {
  readonly resolved: ResolvedConfig;
  readonly ruleId: string;
}): RuleState => {
  if (request.resolved === undefined) {
    return { state: "file-ignored" };
  }
  const entry = request.resolved.rules?.[request.ruleId];
  if (entry === undefined) {
    return { state: "rule-absent" };
  }
  const [severity, ...options] = entry;
  return { state: "configured", severity, options };
};
