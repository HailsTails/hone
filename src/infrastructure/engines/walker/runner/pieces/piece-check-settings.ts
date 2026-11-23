import { z } from "zod";

import type { Result } from "../../../../../domain/result.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { PieceFailure } from "../../../../../domain/runner/piece-failure-types.ts";

export type StringListSettings<Key extends string> = Readonly<Record<Key, readonly string[]>>;

export const stringListCheckSettings = <Key extends string>(request: {
  readonly binding: CheckBinding;
  readonly keys: readonly [Key, ...Key[]];
}): Result<StringListSettings<Key>, PieceFailure> => {
  const parsed = z
    .record(z.enum(request.keys), z.array(z.string().min(1)).readonly())
    .safeParse(request.binding.checkSettings);
  if (parsed.success) return { outcome: "ok", value: parsed.data };
  return {
    outcome: "failed",
    error: {
      kind: "piece-invalid",
      pieceRoot: request.binding.pieceRoot,
      detail: `the checkSettings of ${request.binding.address} are malformed: ${z.prettifyError(parsed.error)}`,
    },
  };
};
