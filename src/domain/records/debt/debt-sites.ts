import type { CheckFinding, NamedGovernedRun } from "../../finding/governance.ts";
import { checkAddressOf } from "../../language-layer/check-address.ts";
import type { SymptomCatalogue } from "../../language-layer/symptom-catalogue.ts";
import { exclusionOf } from "../../repository/exclusion.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import type { RuleSetIdentity } from "../../rule-set/clause-address-types.ts";
import type { EngineId } from "../../rule-set/identifier-types.ts";
import { ownedNameText } from "../../rule-set/rule-set-identity.ts";
import type { UnprojectedFolderReport } from "../../runner/mechanism-run.ts";
import { findingSitesOf, type RaisedFinding } from "../answering/answering.ts";
import type { Site } from "../answering/record-reach.ts";
import { codePointOrder } from "../code-point-order.ts";
import type { UnrecordableSite } from "./unrecordable-site.ts";

export type DebtOrigin = "finding" | "native-exception";

export type SitePlace = { readonly address: string; readonly file: RepoPath };

export type OwnedSitePlace = SitePlace & { readonly ruleSet: RuleSetIdentity };

export type UnprojectedDebtSite = UnprojectedFolderReport & {
  readonly mechanism: EngineId;
};

export type DebtSite = OwnedSitePlace & {
  readonly origin: DebtOrigin;
  readonly unprojected?: UnprojectedDebtSite;
};

type FindingDebtSites = {
  readonly recordable: readonly DebtSite[];
  readonly unrecordable: readonly UnrecordableSite[];
};

export const siteAddressText = (request: { readonly site: SitePlace | OwnedSitePlace }): string =>
  "ruleSet" in request.site
    ? ownedNameText({ ruleSet: request.site.ruleSet, name: request.site.address })
    : request.site.address;

const NOT_REPORTED: RaisedFinding["party"] = { reported: "not-reported" };

const addressOf = (request: { readonly site: Site }): string =>
  request.site.check.found === "check"
    ? checkAddressOf({ check: request.site.check.check })
    : request.site.symptom.name;

const siteKey = (request: { readonly site: SitePlace | UnrecordableSite }): string => {
  const { site } = request;
  return [
    site.file,
    siteAddressText({ site }),
    ...("because" in site ? [JSON.stringify(site.because)] : []),
  ].join("\n");
};

export const inSiteOrder = <Placed extends SitePlace>(request: {
  readonly sites: readonly Placed[];
}): readonly Placed[] => {
  const distinct = [...new Map(request.sites.map((site) => [siteKey({ site }), site])).values()];
  return distinct.toSorted((left, right) =>
    codePointOrder({
      left: siteKey({ site: left }),
      right: siteKey({ site: right }),
    }),
  );
};

export const debtSiteOf = (request: {
  readonly site: Site;
  readonly origin: DebtOrigin;
  readonly run: NamedGovernedRun;
}): DebtSite => {
  const { site, run } = request;
  const outside = run.unprojectedFolders.find(
    ({ folder }) => exclusionOf({ path: site.file, excluded: [folder] }) === "excluded",
  );
  return {
    ruleSet: site.symptom.ruleSet,
    address: addressOf(request),
    file: site.file,
    origin: request.origin,
    ...(outside === undefined ? {} : { unprojected: { ...outside, mechanism: run.mechanism } }),
  };
};

export const sitesOfFinding = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly finding: CheckFinding;
}): readonly Site[] =>
  findingSitesOf({
    raised: { finding: request.finding, party: NOT_REPORTED },
    catalogue: request.catalogue,
  });

const classifyFinding = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly finding: CheckFinding;
  readonly runs: readonly NamedGovernedRun[];
}): FindingDebtSites => {
  const { finding, runs } = request;
  const sites = sitesOfFinding(request);
  const place = { address: finding.check, file: finding.file };
  if (sites.length === 0) {
    return { recordable: [], unrecordable: [{ ...place, because: { kind: "no-check" } }] };
  }
  const run = runs.find(({ mechanism }) => mechanism === finding.mechanism);
  if (run === undefined) {
    return { recordable: [], unrecordable: [{ ...place, because: { kind: "no-run" } }] };
  }
  return {
    recordable: sites.map((site) => debtSiteOf({ site, origin: "finding", run })),
    unrecordable: [],
  };
};

export const debtSitesOf = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly findings: readonly CheckFinding[];
  readonly runs: readonly NamedGovernedRun[];
}): FindingDebtSites => {
  const classified = request.findings.map((finding) => classifyFinding({ ...request, finding }));
  return {
    recordable: inSiteOrder({ sites: classified.flatMap(({ recordable }) => recordable) }),
    unrecordable: inSiteOrder({ sites: classified.flatMap(({ unrecordable }) => unrecordable) }),
  };
};
