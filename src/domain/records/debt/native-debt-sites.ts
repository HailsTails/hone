import type { AttributedNativeException, GovernedRun } from "../../finding/governance.ts";
import type { SymptomCatalogue } from "../../language-layer/symptom-catalogue.ts";
import { clauseAddressText } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import type { RepoPath } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import { nativeSitesOf } from "../answering/answering.ts";
import { type DebtSite, debtSiteOf, inSiteOrder } from "./debt-sites.ts";
import type { UnrecordableBecause, UnrecordableSite } from "./unrecordable-site.ts";

export type NativeDebtSites = { readonly recordable: readonly DebtSite[]; readonly unrecordable: readonly UnrecordableSite[] };

type ExceptionRequest = { readonly exception: AttributedNativeException };

const placeOf = (request: ExceptionRequest): RepoPath => {
  const { exception } = request;
  return exception.kind === "command-line-option" ? exception.location : exception.file;
};

const becauseOf = (request: ExceptionRequest): UnrecordableBecause => {
  const { exception } = request;
  return exception.kind === "command-line-option" ? { kind: exception.kind, cause: exception.cause } : { kind: exception.kind };
};

const unrecordableOf = (request: ExceptionRequest): UnrecordableSite => ({
  address: request.exception.check ?? clauseAddressText({ address: request.exception.clause }),
  file: placeOf(request),
  because: becauseOf(request),
});

const sitesOf = (request: ExceptionRequest & { readonly runs: readonly GovernedRun[]; readonly catalogue: SymptomCatalogue }): NativeDebtSites => {
  const { exception, catalogue } = request;
  const run = request.runs.find((candidate) => candidate.mechanism === exception.mechanism);
  const sites = exception.kind === "config-override" || run === undefined ? [] : nativeSitesOf({ exception, run, catalogue });
  return sites.length === 0
    ? { recordable: [], unrecordable: [unrecordableOf({ exception })] }
    : { recordable: sites.map((site) => debtSiteOf({ site, origin: "native-exception" })), unrecordable: [] };
};

export const nativeDebtSitesOf = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly unrecorded: readonly AttributedNativeException[];
  readonly runs: readonly GovernedRun[];
}): NativeDebtSites => {
  const classified = request.unrecorded.map((exception) => sitesOf({ ...request, exception }));
  return {
    recordable: inSiteOrder({ sites: classified.flatMap((entry) => entry.recordable) }),
    unrecordable: inSiteOrder({ sites: classified.flatMap((entry) => entry.unrecordable) }),
  };
};
