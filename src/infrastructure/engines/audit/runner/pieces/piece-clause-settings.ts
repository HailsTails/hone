import { z } from "zod";
import type { PieceFailure } from "../../../../../domain/runner/piece-failure-types.ts";
import type { RunnerClause } from "../../../../../domain/runner/runner-module-types.ts";
import { clauseAddressText } from "../../../../../domain/rule-set/clause-address.ts";
import type { Result } from "../../../../../domain/result.ts";

export type StringListSettings<Key extends string> = Readonly<Record<Key, readonly string[]>>;

export const stringListClauseSettings = <Key extends string>(request: {
  readonly clause: RunnerClause;
  readonly keys: readonly [Key, ...Key[]];
}): Result<StringListSettings<Key>, PieceFailure> => {
  const parsed = z
    .record(z.enum(request.keys), z.array(z.string().min(1)).readonly())
    .safeParse(request.clause.clauseSettings);
  if (parsed.success) return { outcome: "ok", value: parsed.data };
  return {
    outcome: "failed",
    error: {
      kind: "piece-invalid",
      pieceRoot: request.clause.pieceRoot,
      detail: `the clauseSettings of ${clauseAddressText({ address: request.clause.address })} are malformed: ${z.prettifyError(parsed.error)}`,
    },
  };
};
