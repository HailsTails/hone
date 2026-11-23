import type { CheckAddressText } from "../language-layer/check-address-text.ts";
import type { ClauseAddress } from "../rule-set/clause-address-types.ts";

export type CaseMismatch = {
  readonly caseName: string;
  readonly expectedLines: readonly number[];
  readonly flaggedLines: readonly number[];
};

export type ConformanceFailure = CaseMismatch & { readonly clause: ClauseAddress };
export type CheckConformanceFailure = CaseMismatch & { readonly check: CheckAddressText };
