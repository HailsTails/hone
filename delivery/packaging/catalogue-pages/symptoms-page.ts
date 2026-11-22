import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { anchorOf, blocksOf, type CataloguePage, itemPaths, type PageSource, pageOf, pointedTitleOf, proseAt } from "./catalogue-page.ts";
import { checkTodayOf } from "./check-today.ts";

const PAGE = "typescript/symptoms.md";

type Symptom = CatalogueFile["symptoms"][number];

type Indication = Symptom["mayIndicate"][number];

type CorrectUse = Symptom["correctUses"][number];

const REPORTS_TEXT: Readonly<Record<NonNullable<Symptom["reports"]>, string>> = { seen: "seen", "seen-to-breach": "seen → breach" };

const indicationText = (request: { readonly file: CatalogueFile; readonly indication: Indication }): string => {
  const { indication, file } = request;
  const caseTitle = file.cases.find((entry) => entry.name === indication.case)?.title ?? indication.case;
  const situation = indication.situation === undefined ? "" : `: ${indication.situation}`;
  const quote = indication.quote === undefined ? "" : ` ("${indication.quote}")`;
  return `${caseTitle}${situation} → ${indication.points.map((point) => pointedTitleOf({ file, point })).join(", ")}${quote}`;
};

const correctUseText = (request: { readonly file: CatalogueFile; readonly use: CorrectUse }): string => {
  const phrase = request.file.recordKinds.find((kind) => kind.name === request.use.kind)?.phrase ?? request.use.kind;
  return request.use.at === undefined ? `${request.use.situation}: ${phrase}` : `${request.use.situation}: ${phrase} ${request.use.at}`;
};

const listLine = (request: { readonly label: string; readonly entries: readonly string[]; readonly separator: string }): string =>
  request.entries.length === 0 ? "" : `- **${request.label}:** ${request.entries.join(request.separator)}.`;

const factLinesOf = (request: PageSource & { readonly symptom: Symptom }): string => {
  const { symptom, file } = request;
  const checks = file.checks.filter((check) => check.symptom === symptom.name);
  const recipes = file.recipes.filter((recipe) => symptom.recipes.includes(recipe.name));
  return [
    `- **Seen:** ${symptom.seen}`,
    listLine({ label: "May indicate", entries: symptom.mayIndicate.map((indication) => indicationText({ file, indication })), separator: "; " }),
    `- **Breach usually sits:** ${symptom.breachUsuallySits}.`,
    listLine({ label: "Covered by a record", entries: symptom.correctUses.map((use) => correctUseText({ file, use })), separator: "; " }),
    listLine({ label: "Seen by", entries: symptom.seenBy, separator: ", " }),
    symptom.reports === undefined ? "" : `- **Reports:** ${REPORTS_TEXT[symptom.reports]}.`,
    `- **Check today:** ${checkTodayOf({ file, symptom })}.`,
    listLine({ label: "Checks", entries: checks.map((check) => `[${check.name}](symptoms/${check.symptom}/${check.name}.md)`), separator: ", " }),
    listLine({ label: "Recipes", entries: recipes.map((recipe) => `[${recipe.title}](recipes.md#${anchorOf({ title: recipe.title })})`), separator: "; " }),
  ]
    .filter((line) => line.length > 0)
    .join("\n");
};

const symptomBlockOf = (request: PageSource & { readonly symptom: Symptom }): string =>
  blocksOf({ blocks: [`### ${request.symptom.title}`, factLinesOf(request), proseAt({ prose: request.prose, path: itemPaths.symptom(request.symptom), pagePath: PAGE })] });

const groupsOf = (request: { readonly symptoms: readonly Symptom[] }): readonly string[] => [...new Set(request.symptoms.map((symptom) => symptom.group))];

export const symptomsPageOf = (request: PageSource): CataloguePage =>
  pageOf({
    path: `rules/${PAGE}`,
    blocks: [
      "# Symptoms in TypeScript",
      ...groupsOf({ symptoms: request.file.symptoms }).map((group) =>
        blocksOf({
          blocks: [`## ${group}`, ...request.file.symptoms.filter((symptom) => symptom.group === group).map((symptom) => symptomBlockOf({ ...request, symptom }))],
        }),
      ),
    ],
  });
