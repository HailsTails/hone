import { describe, expect, it } from "vitest";
import type { VersionTwoLoadFailure } from "../load-failure.ts";
import { createDefaultFileTextPort } from "../../node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../node/path-port.ts";
import { createSymptomCatalogueRepository } from "../../content-files/symptom-catalogues/read-symptom-catalogue.ts";
import type { CatalogueHolding, SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import { absolutePathSchema } from "../../content-files/absolute-path.ts";
import { clauseAddressText } from "../../discipline-exceptions-folder/clause-address.ts";
import type { Result } from "../../../domain/result.ts";

type GuideCheckRow = { readonly check: string; readonly engines: readonly string[]; readonly clause: string };

const CHECK_TABLE_INTRO = "Every check Hone ships";

const CHECK_ROW = /^\| `([^`]+)` \| (`[a-z-]+`(?: or `[a-z-]+`)*) \| `([^`]+)` \|$/;

const ENGINE_NAME = /`([a-z-]+)`/g;

const REPOSITORY_ROOT = createDefaultPathPort({}).join({ segments: [`${import.meta.dirname}/../../..`, ".."] });

const guideRead = createDefaultFileTextPort({}).read({ path: `${REPOSITORY_ROOT}/ADOPTING.md` });

const ADOPTING_GUIDE_TEXT = guideRead.outcome === "ok" ? guideRead.value : "";

type GuideCheckTable = { readonly rows: readonly GuideCheckRow[]; readonly unread: readonly string[] };

const TABLE_HEADER_LINES = 2;

const LINE_BREAK = "\n";

const tableLinesAfter = (request: { readonly lines: readonly string[] }): readonly string[] => {
  const first = request.lines.findIndex((line) => line.startsWith("|"));
  const after = first === -1 ? [] : request.lines.slice(first);
  const end = after.findIndex((line) => !line.startsWith("|"));
  return (end === -1 ? after : after.slice(0, end)).slice(TABLE_HEADER_LINES);
};

const guideCheckTableOf = (request: { readonly text: string }): GuideCheckTable => {
  const introAt = request.text.indexOf(CHECK_TABLE_INTRO);
  const lines = introAt === -1 ? [] : request.text.slice(introAt).split(LINE_BREAK).map((line) => line.trimEnd());
  const parsed = tableLinesAfter({ lines }).map((line) => ({ line, row: CHECK_ROW.exec(line) }));
  return {
    rows: parsed.flatMap(({ row }) => (row === null ? [] : [{ check: row[1], engines: [...row[2].matchAll(ENGINE_NAME)].map((engine) => engine[1]), clause: row[3] }])),
    unread: parsed.filter(({ row }) => row === null).map(({ line }) => line),
  };
};

const catalogueCheckRowsOf = (request: { readonly catalogue: SymptomCatalogue }): readonly GuideCheckRow[] =>
  request.catalogue.checks.map((check) => ({ check: `${check.symptom.name}#${check.name}`, engines: check.engines.map((engine) => engine.name), clause: clauseAddressText({ address: check.clause }) }));

const shippedCatalogueHolding = (): Result<CatalogueHolding, VersionTwoLoadFailure> =>
  createSymptomCatalogueRepository({
    fileText: createDefaultFileTextPort({}),
    path: createDefaultPathPort({}),
    ruleSetRoot: absolutePathSchema.parse(REPOSITORY_ROOT),
  }).read({});

const byCheck = (left: GuideCheckRow, right: GuideCheckRow): number => left.check.localeCompare(right.check);

const shippedCheckRows = (): readonly GuideCheckRow[] => {
  const holding = shippedCatalogueHolding();
  return holding.outcome === "ok" && holding.value.held === "catalogue" ? catalogueCheckRowsOf({ catalogue: holding.value.catalogue }).toSorted(byCheck) : [];
};

const documentedCheckRows = (request: { readonly text: string }): readonly GuideCheckRow[] => guideCheckTableOf(request).rows.toSorted(byCheck);

describe("the table of checks in the adopting guide, read against the shipped symptom catalogue (CD-47: the shipped guide and catalogue are the assertion's subject; nothing is spawned or written)", () => {
  it("holds a row for every check the catalogue ships with its engines and clause address, and no row for a check it does not", () => {
    expect(documentedCheckRows({ text: ADOPTING_GUIDE_TEXT })).toEqual(shippedCheckRows());
  });

  it("reads every line of the table, so a row written in a form the reader does not know cannot drop out of the comparison", () => {
    expect(guideCheckTableOf({ text: ADOPTING_GUIDE_TEXT }).unread).toEqual([]);
  });

  it("reads the catalogue, so an empty table cannot match an unread one", () => {
    expect(shippedCheckRows()).not.toHaveLength(0);
  });
});
