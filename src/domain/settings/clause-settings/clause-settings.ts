import type { ClauseAddress } from "../../rule-set/clause-address-types.ts";
import type { ReadonlyJsonValue } from "../json-values/json-value.ts";

export type ClauseSettings = readonly (readonly [ClauseAddress, { readonly [key: string]: ReadonlyJsonValue }])[];
