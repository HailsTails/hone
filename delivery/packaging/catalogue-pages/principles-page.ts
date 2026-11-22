import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { anchorOf, blocksOf, type CataloguePage, itemPaths, type PageSource, pageOf, proseAt } from "./catalogue-page.ts";

const PAGE = "principles.md";

type Rule = CatalogueFile["rules"][number];

const ruleLinksOf = (request: { readonly rules: readonly Rule[] }): string =>
  request.rules.map((rule) => `[${rule.title}](rules.md#${anchorOf({ title: rule.title })})`).join(", ");

const acceptedRulesOf = (request: { readonly rules: readonly Rule[] }): string => (request.rules.length === 0 ? "" : `${ruleLinksOf(request)}.`);

const proposedRulesOf = (request: { readonly rules: readonly Rule[] }): string =>
  request.rules.length === 0 ? "" : `Proposed, not accepted: ${ruleLinksOf(request)}.`;

const rulesUnderOf = (request: { readonly file: CatalogueFile; readonly principle: string }): string => {
  const rules = request.file.rules.filter((rule) => rule.principle === request.principle);
  if (rules.length === 0) {
    return "- **Rules under it:** none. The principle decides.";
  }
  return [
    "- **Rules under it:**",
    acceptedRulesOf({ rules: rules.filter((rule) => rule.standing === "accepted") }),
    proposedRulesOf({ rules: rules.filter((rule) => rule.standing === "proposed") }),
  ]
    .filter((part) => part.length > 0)
    .join(" ");
};

export const principlesPageOf = (request: PageSource): CataloguePage =>
  pageOf({
    path: `rules/${PAGE}`,
    blocks: [
      "# Principles",
      ...request.file.principles.map((principle) =>
        blocksOf({
          blocks: [
            `## ${principle.title}`,
            proseAt({ prose: request.prose, path: itemPaths.principle(principle), pagePath: PAGE }),
            rulesUnderOf({ file: request.file, principle: principle.name }),
          ],
        }),
      ),
    ],
  });
