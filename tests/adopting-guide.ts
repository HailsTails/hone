import type { VersionTwoLoadFailure } from "../src/infrastructure/command-line/load-failure.ts";
import { createDefaultFileTextPort } from "../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../src/infrastructure/node/path-port.ts";
import { createSymptomCatalogueRepository } from "../src/infrastructure/content-files/symptom-catalogues/read-symptom-catalogue.ts";
import type { CatalogueHolding, SymptomCatalogue } from "../src/domain/language-layer/symptom-catalogue.ts";
import { absolutePathSchema } from "../src/infrastructure/content-files/absolute-path.ts";
import { clauseAddressText } from "../src/infrastructure/discipline-exceptions-folder/clause-address.ts";
import type { Result } from "../src/domain/result.ts";
import { repositoryRootOf } from "./allowed-forms-proof.ts";
import { contractTextAt } from "./output-contract.ts";

export type GuideCheckRow = { readonly check: string; readonly engines: readonly string[]; readonly clause: string };

export type FencedBlock = { readonly language: string; readonly body: string };

const CHECK_TABLE_INTRO = "Every check Hone ships";

const CHECK_ROW = /^\| `([^`]+)` \| (`[a-z-]+`(?: or `[a-z-]+`)*) \| `([^`]+)` \|$/;

const ENGINE_NAME = /`([a-z-]+)`/g;

const FENCED_BLOCK = /^```(\w*)\n([\s\S]*?)\n```$/gm;

const WORKED_EXAMPLE_HEADING = "\n## Worked example\n";

const NEXT_HEADING = "\n## ";

const INSTALLED_RULES = "node_modules/@hailstails/hone/rules/";

const SOURCE_RULES = "../../../../../../rules/";

const REPOSITORY_ROOT = repositoryRootOf({ testFolder: import.meta.dirname });

export const ADOPTING_GUIDE_TEXT = contractTextAt({ path: `${REPOSITORY_ROOT}/ADOPTING.md` });

export type GuideCheckTable = { readonly rows: readonly GuideCheckRow[]; readonly unread: readonly string[] };

const TABLE_HEADER_LINES = 2;

const LINE_BREAK = "\n";

const tableLinesAfter = (request: { readonly lines: readonly string[] }): readonly string[] => {
  const first = request.lines.findIndex((line) => line.startsWith("|"));
  const after = first === -1 ? [] : request.lines.slice(first);
  const end = after.findIndex((line) => !line.startsWith("|"));
  return (end === -1 ? after : after.slice(0, end)).slice(TABLE_HEADER_LINES);
};

export const guideCheckTableOf = (request: { readonly text: string }): GuideCheckTable => {
  const introAt = request.text.indexOf(CHECK_TABLE_INTRO);
  const lines = introAt === -1 ? [] : request.text.slice(introAt).split(LINE_BREAK).map((line) => line.trimEnd());
  const parsed = tableLinesAfter({ lines }).map((line) => ({ line, row: CHECK_ROW.exec(line) }));
  return {
    rows: parsed.flatMap(({ row }) => (row === null ? [] : [{ check: row[1], engines: [...row[2].matchAll(ENGINE_NAME)].map((engine) => engine[1]), clause: row[3] }])),
    unread: parsed.filter(({ row }) => row === null).map(({ line }) => line),
  };
};

export const catalogueCheckRowsOf = (request: { readonly catalogue: SymptomCatalogue }): readonly GuideCheckRow[] =>
  request.catalogue.checks.map((check) => ({ check: `${check.symptom.name}#${check.name}`, engines: check.engines.map((engine) => engine.name), clause: clauseAddressText({ address: check.clause }) }));

export const shippedCatalogueHolding = (): Result<CatalogueHolding, VersionTwoLoadFailure> =>
  createSymptomCatalogueRepository({
    fileText: createDefaultFileTextPort({}),
    path: createDefaultPathPort({}),
    ruleSetRoot: absolutePathSchema.parse(REPOSITORY_ROOT),
  }).read({});

export type WorkedExample = {
  readonly blocks: number;
  readonly settings: FencedBlock;
  readonly beforeReport: FencedBlock;
  readonly records: FencedBlock;
  readonly afterReport: FencedBlock;
};

const MISSING_BLOCK: FencedBlock = { language: "missing", body: "" };

const workedExampleBlocksOf = (request: { readonly text: string }): readonly FencedBlock[] => {
  const from = request.text.slice(request.text.indexOf(WORKED_EXAMPLE_HEADING) + 1);
  const next = from.indexOf(NEXT_HEADING);
  const section = next === -1 ? from : from.slice(0, next);
  return [...section.matchAll(FENCED_BLOCK)].map((block) => ({ language: block[1], body: block[2] }));
};

export const workedExampleOf = (request: { readonly text: string }): WorkedExample => {
  const blocks = workedExampleBlocksOf(request);
  const [settings, beforeReport, records, afterReport] = blocks;
  return { blocks: blocks.length, settings: settings ?? MISSING_BLOCK, beforeReport: beforeReport ?? MISSING_BLOCK, records: records ?? MISSING_BLOCK, afterReport: afterReport ?? MISSING_BLOCK };
};

export const reportAsInstalled = (request: { readonly text: string }): string => request.text.replaceAll(SOURCE_RULES, INSTALLED_RULES);

const byCheck = (left: GuideCheckRow, right: GuideCheckRow): number => left.check.localeCompare(right.check);

export const shippedCheckRows = (): readonly GuideCheckRow[] => {
  const holding = shippedCatalogueHolding();
  return holding.outcome === "ok" && holding.value.held === "catalogue" ? catalogueCheckRowsOf({ catalogue: holding.value.catalogue }).toSorted(byCheck) : [];
};

export const documentedCheckRows = (request: { readonly text: string }): readonly GuideCheckRow[] => guideCheckTableOf(request).rows.toSorted(byCheck);

export const TABLE = [
  "Every check Hone ships, with the engines.",
  "",
  "| Check to list | Engines | Clause address on the rule pages |",
  "|---|---|---|",
  "| `loop-keyword#loop-statement` | `walker` | `CD-15#loops` |",
  "| `authored-class-or-this#class-keyword` | `walker` or `eslint` | `CD-14#class-syntax` |",
  "",
  "| `not-a-check` | `walker` | `CD-0#after-the-table` |",
].join("\n");

export const TABLE_WITH_A_COMMA = TABLE.replace("`walker` or `eslint`", "`walker`, `eslint`");

const FENCE = "```";

export const WORKED_EXAMPLE = [
  "## Known",
  "",
  `${FENCE}json`,
  "{ \"before\": \"the section\" }",
  FENCE,
  "",
  "## Worked example",
  "",
  `${FENCE}json`,
  "{ \"settings\": 1 }",
  FENCE,
  "",
  `${FENCE}text`,
  "before report",
  FENCE,
  "",
  `${FENCE}json`,
  "{ \"records\": 2 }",
  FENCE,
  "",
  `${FENCE}text`,
  "after report",
  FENCE,
  "",
  "## Known gaps",
  "",
  `${FENCE}text`,
  "after the section",
  FENCE,
].join("\n");
