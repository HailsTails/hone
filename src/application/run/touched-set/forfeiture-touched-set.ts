import type { RenamedSinceBase } from "../../../domain/repository/renamed-path.ts";
import { type TouchedSet, withoutPureMoves } from "../../../domain/repository/touched-set.ts";
import { type ChangeMeasurement, computeTouchedSet } from "./touched-set.ts";

type TouchedRequest = ChangeMeasurement & { readonly renamed: RenamedSinceBase };

const touchedBeyondPureMoves = (request: TouchedRequest): TouchedSet => {
  const touched = computeTouchedSet(request);
  if (touched.measured === "no") {
    return touched;
  }
  return request.renamed.measured === "no"
    ? { measured: "no", base: request.renamed.base }
    : withoutPureMoves({ touched, renamed: request.renamed.renamed });
};

export const touchedSetUnder = (
  request: Omit<TouchedRequest, "baseScope"> & {
    readonly baseScope: TouchedRequest["baseScope"] | "elsewhere";
  },
): TouchedSet => {
  const { baseScope } = request;
  return baseScope === "elsewhere"
    ? { measured: "elsewhere" }
    : touchedBeyondPureMoves({ ...request, baseScope });
};
