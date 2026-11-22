import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import {
  anchorOf,
  blocksOf,
  type CataloguePage,
  everyRendered,
  type FactLabel,
  factLines,
  itemPaths,
  namedEntryOf,
  type PageSource,
  pageOf,
  pointedTitleOf,
  proseAt,
  type Rendered,
} from "./catalogue-page.ts";
import { checkTodayOf } from "./check-today.ts";

const PAGE = "typescript/symptoms.md";

type Symptom = CatalogueFile["symptoms"][number];

type Indication = Symptom["mayIndicate"][number];

type CorrectUse = Symptom["correctUses"][number];

const BREACH_LABELS: readonly FactLabel<
  "howItIsSeen" | "breachACheckCouldName" | "toNameTheBreach"
>[] = [
  { key: "howItIsSeen", label: "How it is seen" },
  { key: "breachACheckCouldName", label: "The breach a check could name" },
  { key: "toNameTheBreach", label: "To name the breach, a check needs" },
];

const REPORTS_TEXT: Readonly<Record<NonNullable<Symptom["reports"]>, string>> = {
  seen: "seen",
  "seen-to-breach": "seen → breach",
};

const indicationText = (request: {
  readonly file: CatalogueFile;
  readonly indication: Indication;
}): Rendered<string> => {
  const { indication, file } = request;
  const indicated = namedEntryOf({ entries: file.cases, name: indication.case, listing: "cases" });
  if (indicated.outcome === "failed") {
    return indicated;
  }
  const titles = everyRendered({
    entries: indication.points,
    render: (point) => pointedTitleOf({ file, point }),
  });
  if (titles.outcome === "failed") {
    return titles;
  }
  const situation = indication.situation === undefined ? "" : `: ${indication.situation}`;
  const quote = indication.quote === undefined ? "" : ` ("${indication.quote}")`;
  return {
    outcome: "ok",
    value: `${indicated.value.title}${situation} → ${titles.value.join(", ")}${quote}`,
  };
};

const correctUseText = (request: {
  readonly file: CatalogueFile;
  readonly use: CorrectUse;
}): Rendered<string> => {
  const kind = namedEntryOf({
    entries: request.file.recordKinds,
    name: request.use.kind,
    listing: "record kinds",
  });
  if (kind.outcome === "failed") {
    return kind;
  }
  const { situation, at } = request.use;
  return {
    outcome: "ok",
    value:
      at === undefined
        ? `${situation}: ${kind.value.phrase}`
        : `${situation}: ${kind.value.phrase} ${at}`,
  };
};

const listLine = (request: {
  readonly label: string;
  readonly entries: readonly string[];
  readonly separator: string;
}): string =>
  request.entries.length === 0
    ? ""
    : `- **${request.label}:** ${request.entries.join(request.separator)}.`;

const factLinesOf = (request: PageSource & { readonly symptom: Symptom }): Rendered<string> => {
  const { symptom, file } = request;
  const indications = everyRendered({
    entries: symptom.mayIndicate,
    render: (indication) => indicationText({ file, indication }),
  });
  if (indications.outcome === "failed") {
    return indications;
  }
  const uses = everyRendered({
    entries: symptom.correctUses,
    render: (use) => correctUseText({ file, use }),
  });
  if (uses.outcome === "failed") {
    return uses;
  }
  const checks = file.checks.filter((check) => check.symptom === symptom.name);
  const recipes = file.recipes.filter((recipe) => symptom.recipes.includes(recipe.name));
  const lines = [
    `- **Seen:** ${symptom.seen}`,
    listLine({ label: "May indicate", entries: indications.value, separator: "; " }),
    `- **Breach usually sits:** ${symptom.breachUsuallySits}.`,
    listLine({ label: "Covered by a record", entries: uses.value, separator: "; " }),
    listLine({ label: "Seen by", entries: symptom.seenBy, separator: ", " }),
    symptom.reports === undefined ? "" : `- **Reports:** ${REPORTS_TEXT[symptom.reports]}.`,
    factLines({ facts: symptom, labels: BREACH_LABELS }),
    `- **Check today:** ${checkTodayOf({ file, symptom })}.`,
    listLine({
      label: "Checks",
      entries: checks.map((check) => `[${check.name}](symptoms/${check.symptom}/${check.name}.md)`),
      separator: ", ",
    }),
    listLine({
      label: "Recipes",
      entries: recipes.map(
        (recipe) => `[${recipe.title}](recipes.md#${anchorOf({ title: recipe.title })})`,
      ),
      separator: "; ",
    }),
  ];
  return { outcome: "ok", value: lines.filter((line) => line.length > 0).join("\n") };
};

const symptomBlockOf = (request: PageSource & { readonly symptom: Symptom }): Rendered<string> => {
  const facts = factLinesOf(request);
  return facts.outcome === "failed"
    ? facts
    : {
        outcome: "ok",
        value: blocksOf({
          blocks: [
            `### ${request.symptom.title}`,
            facts.value,
            proseAt({
              path: request.path,
              prose: request.prose,
              itemPath: itemPaths.symptom(request.symptom),
              pagePath: PAGE,
            }),
          ],
        }),
      };
};

const groupsOf = (request: { readonly symptoms: readonly Symptom[] }): readonly string[] => [
  ...new Set(request.symptoms.map((symptom) => symptom.group)),
];

const groupBlockOf = (request: PageSource & { readonly group: string }): Rendered<string> => {
  const symptoms = request.file.symptoms.filter((symptom) => symptom.group === request.group);
  const blocks = everyRendered({
    entries: symptoms,
    render: (symptom) => symptomBlockOf({ ...request, symptom }),
  });
  return blocks.outcome === "failed"
    ? blocks
    : { outcome: "ok", value: blocksOf({ blocks: [`## ${request.group}`, ...blocks.value] }) };
};

export const symptomsPageOf = (request: PageSource): Rendered<CataloguePage> => {
  const groups = everyRendered({
    entries: groupsOf({ symptoms: request.file.symptoms }),
    render: (group) => groupBlockOf({ ...request, group }),
  });
  return groups.outcome === "failed"
    ? groups
    : {
        outcome: "ok",
        value: pageOf({
          path: `rules/${PAGE}`,
          blocks: ["# Symptoms in TypeScript", ...groups.value],
        }),
      };
};
