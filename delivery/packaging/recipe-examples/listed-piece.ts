import type { CheckAddressText } from "../../../src/domain/language-layer/check-address-text.ts";
import type { Edition } from "../../../src/domain/rule-set/edition-types.ts";
import type { EngineId } from "../../../src/domain/rule-set/identifier-types.ts";

export type ListedPiece = {
  readonly engine: EngineId;
  readonly check: CheckAddressText;
  readonly editions: readonly Edition[];
};
