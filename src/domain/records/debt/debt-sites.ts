import type { CheckFinding } from "../../finding/governance.ts";
import { checkAddressOf } from "../../language-layer/check-address.ts";
import type { SymptomCatalogue } from "../../language-layer/symptom-catalogue.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import { findingSitesOf, type RaisedFinding } from "../answering/answering.ts";
import type { Site } from "../answering/record-reach.ts";
import { codePointOrder } from "../code-point-order.ts";
import type { UnrecordableSite } from "./unrecordable-site.ts";

export type DebtOrigin = "finding" | "native-exception";

export type SitePlace = { readonly address: string; readonly file: RepoPath };

export type DebtSite = SitePlace & { readonly origin: DebtOrigin };

const NOT_REPORTED: RaisedFinding["party"] = { reported: "not-reported" };

const addressOf = (request: { readonly site: Site }): string =>
  request.site.check.found === "check"
    ? checkAddressOf({ check: request.site.check.check })
    : request.site.symptom.name;

const siteKey = (request: { readonly site: SitePlace | UnrecordableSite }): string => {
  const { site } = request;
  return [
    site.file,
    site.address,
    ...("because" in site ? [JSON.stringify(site.because)] : []),
  ].join("\n");
};

export const inSiteOrder = <Placed extends SitePlace>(request: {
  readonly sites: readonly Placed[];
}): readonly Placed[] => {
  const distinct = [...new Map(request.sites.map((site) => [siteKey({ site }), site])).values()];
  return distinct.toSorted((left, right) =>
    codePointOrder({ left: siteKey({ site: left }), right: siteKey({ site: right }) }),
  );
};

export const debtSiteOf = (request: {
  readonly site: Site;
  readonly origin: DebtOrigin;
}): DebtSite => ({
  address: addressOf(request),
  file: request.site.file,
  origin: request.origin,
});

export const sitesOfFinding = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly finding: CheckFinding;
}): readonly Site[] =>
  findingSitesOf({
    raised: { finding: request.finding, party: NOT_REPORTED },
    catalogue: request.catalogue,
  });

export const debtSitesOf = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly findings: readonly CheckFinding[];
}): readonly DebtSite[] =>
  inSiteOrder({
    sites: request.findings
      .flatMap((finding) => sitesOfFinding({ catalogue: request.catalogue, finding }))
      .map((site) => debtSiteOf({ site, origin: "finding" })),
  });

export const unrecordableSitesOf = (request: {
  readonly catalogue: SymptomCatalogue;
  readonly findings: readonly CheckFinding[];
}): readonly UnrecordableSite[] =>
  inSiteOrder({
    sites: request.findings
      .filter((finding) => sitesOfFinding({ catalogue: request.catalogue, finding }).length === 0)
      .map((finding): UnrecordableSite => ({
        address: finding.check,
        file: finding.file,
        because: { kind: "no-check" },
      })),
  });
