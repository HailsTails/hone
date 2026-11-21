import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../src/infrastructure/node/file-system/file-text-port.ts";
import type { PathPort } from "../src/infrastructure/node/path-port.ts";
import type { Check, Engine, RecordKind, Symptom, SymptomCatalogue } from "../src/domain/language-layer/symptom-catalogue.ts";
import { absolutePathSchema } from "../src/infrastructure/content-files/absolute-path.ts";
import { clauseAddressSchema } from "../src/infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../src/infrastructure/hone-config-file/identifiers.ts";
import {
  catalogueCoverageOf,
  checkAddressTableOf,
  checkCoverageOf,
  correctUseNotesOf,
  formSectionsOf,
  symptomNamesOf,
  symptomsNamedByRecordReachButNotCatalogued,
  unresolvedAddressesOf,
} from "./symptom-catalogue-coverage.ts";

const RULE_SET_ROOT = absolutePathSchema.parse("/install");

const DISCIPLINE_PATH = "/install/rules/CD-44/discipline.json";

const CD44_TEXT = `{
  "version": 1,
  "id": "CD-44",
  "clauses": [
    { "kind": "judgement", "id": "parameter-mutation", "summary": "Write into no parameter.", "enforcedBy": "review" },
    { "kind": "judgement", "id": "parameter-reassignment", "summary": "Rebind no parameter.", "enforcedBy": "review" }
  ]
}`;

const symptomNamed = (name: string): Symptom => ({
  name,
  title: name,
  seen: name,
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
});

const DEBT: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const NOTHING_CATALOGUED: SymptomCatalogue = {
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION, DEBT],
  alwaysRecordable: { debt: DEBT, authorisedLocation: AUTHORISED_LOCATION },
  engines: [],
  symptoms: [],
  clauses: [],
  checks: [],
  namedBans: [],
};

const CATALOGUE: SymptomCatalogue = {
  ...NOTHING_CATALOGUED,
  clauses: [
    {
      clause: clauseAddressSchema.parse("CD-44#parameter-mutation"),
      sight: { kind: "one-symptom", symptom: symptomNamed("write-into-a-parameter") },
    },
    {
      clause: clauseAddressSchema.parse("CD-27#test-body-logic"),
      sight: {
        kind: "symptom-by-form",
        forms: [
          { section: "branching-with-if", symptom: symptomNamed("branch-in-a-test") },
          { section: "a-let", symptom: symptomNamed("rebinding") },
        ],
      },
    },
  ],
};

const fileTextReading = (read: ReturnType<FileTextPort["read"]>): FileTextPort => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue(read),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  write: vi.fn<FileTextPort["write"]>(),
});

const pathJoiningTo = (joined: string): PathPort => ({
  join: vi.fn<PathPort["join"]>().mockReturnValue(joined),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  relative: vi.fn<PathPort["relative"]>(),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
});

describe("catalogueCoverageOf", () => {
  it("names each clause a discipline defines that the catalogue lacks, and each catalogued clause no discipline defines", () => {
    const fileText = fileTextReading({ outcome: "ok", value: CD44_TEXT });
    const path = pathJoiningTo(DISCIPLINE_PATH);
    expect(catalogueCoverageOf({ catalogue: CATALOGUE, fileText, path, ruleSetRoot: RULE_SET_ROOT, disciplines: ["CD-44"] })).toEqual({
      uncatalogued: ["CD-44#parameter-reassignment"],
      unknown: ["CD-27#test-body-logic"],
      unreadable: [],
    });
    expect(path.join).toHaveBeenCalledExactlyOnceWith({ segments: ["/install", "rules", "CD-44", "discipline.json"] });
    expect(fileText.read).toHaveBeenCalledExactlyOnceWith({ path: DISCIPLINE_PATH });
    expect(fileText.write).not.toHaveBeenCalled();
  });

  it("names nothing missing when the catalogue lists each clause of the disciplines and no other", () => {
    const fileText = fileTextReading({ outcome: "ok", value: CD44_TEXT });
    const catalogue: SymptomCatalogue = {
      ...NOTHING_CATALOGUED,
      clauses: [
        { clause: clauseAddressSchema.parse("CD-44#parameter-mutation"), sight: { kind: "outside-the-cases" } },
        { clause: clauseAddressSchema.parse("CD-44#parameter-reassignment"), sight: { kind: "outside-the-cases" } },
      ],
    };
    expect(
      catalogueCoverageOf({ catalogue, fileText, path: pathJoiningTo(DISCIPLINE_PATH), ruleSetRoot: RULE_SET_ROOT, disciplines: ["CD-44"] }),
    ).toEqual({ uncatalogued: [], unknown: [], unreadable: [] });
  });

  it("names a discipline file it cannot read, and counts its clauses as defined by none", () => {
    const fileText = fileTextReading({ outcome: "failed", error: { kind: "unreadable", path: DISCIPLINE_PATH, detail: "ENOENT" } });
    expect(
      catalogueCoverageOf({ catalogue: CATALOGUE, fileText, path: pathJoiningTo(DISCIPLINE_PATH), ruleSetRoot: RULE_SET_ROOT, disciplines: ["CD-44"] }),
    ).toEqual({
      uncatalogued: [],
      unknown: ["CD-44#parameter-mutation", "CD-27#test-body-logic"],
      unreadable: [{ kind: "file-unreadable", path: DISCIPLINE_PATH, detail: "ENOENT" }],
    });
  });

  it("names a folder that is not a discipline id as unreadable, reading nothing", () => {
    const fileText = fileTextReading({ outcome: "ok", value: CD44_TEXT });
    expect(
      catalogueCoverageOf({ catalogue: CATALOGUE, fileText, path: pathJoiningTo(DISCIPLINE_PATH), ruleSetRoot: RULE_SET_ROOT, disciplines: ["typescript"] }),
    ).toEqual({
      uncatalogued: [],
      unknown: ["CD-44#parameter-mutation", "CD-27#test-body-logic"],
      unreadable: [{ kind: "unknown-discipline", address: "typescript" }],
    });
    expect(fileText.read).not.toHaveBeenCalled();
  });
});

describe("formSectionsOf", () => {
  it("lists the sections of a by-form clause in catalogue order", () => {
    expect(formSectionsOf({ catalogue: CATALOGUE, clause: "CD-27#test-body-logic" })).toEqual(["branching-with-if", "a-let"]);
  });

  it("lists no section for a clause that sees one symptom", () => {
    expect(formSectionsOf({ catalogue: CATALOGUE, clause: "CD-44#parameter-mutation" })).toEqual([]);
  });

  it("lists no section for a clause the catalogue does not hold", () => {
    expect(formSectionsOf({ catalogue: CATALOGUE, clause: "CD-15#loops" })).toEqual([]);
  });
});

describe("symptomNamesOf", () => {
  it("lists each symptom's name in catalogue order", () => {
    expect(symptomNamesOf({ catalogue: { ...NOTHING_CATALOGUED, symptoms: [symptomNamed("rebinding"), symptomNamed("loop-keyword")] } })).toEqual([
      "rebinding",
      "loop-keyword",
    ]);
  });
});

const NAMED_BY_RECORD_REACH: readonly string[] = [
  "outside-import-past-a-boundary",
  "library-class-built-in-place",
  "outside-type-in-a-signature",
  "date-used-directly",
  "ambient-randomness",
  "process-global-used-in-place",
  "text-past-its-reader",
];

describe("symptomsNamedByRecordReachButNotCatalogued", () => {
  it("lists every symptom a record's reach names when the catalogue holds none", () => {
    expect(symptomsNamedByRecordReachButNotCatalogued({ catalogue: NOTHING_CATALOGUED })).toEqual(NAMED_BY_RECORD_REACH);
  });

  it("lists only the symptoms the catalogue lacks", () => {
    expect(
      symptomsNamedByRecordReachButNotCatalogued({
        catalogue: {
          ...NOTHING_CATALOGUED,
          symptoms: [
            symptomNamed("outside-import-past-a-boundary"),
            symptomNamed("library-class-built-in-place"),
            symptomNamed("outside-type-in-a-signature"),
            symptomNamed("date-used-directly"),
            symptomNamed("ambient-randomness"),
            symptomNamed("process-global-used-in-place"),
          ],
        },
      }),
    ).toEqual(["text-past-its-reader"]);
  });
});

const LOOP_KEYWORD: Symptom = {
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "A for or while statement.",
  mayIndicate: [
    {
      case: {
        name: "makes-a-new-value-from-what-it-has",
        title: "Makes a new value from what it has",
        standing: "accepted",
        owes: [{ kind: "principle", principle: { name: "one-place-decides", title: "One place decides" } }],
      },
      points: [{ kind: "principle", principle: { name: "one-place-decides", title: "One place decides" } }],
    },
  ],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [{ situation: "draining a stream", kind: AUTHORISED_LOCATION, at: "in its source's adapter" }],
};

const CD44_MECHANICAL_TEXT = `{
  "version": 1,
  "id": "CD-44",
  "clauses": [
    {
      "kind": "mechanical",
      "id": "parameter-mutation",
      "summary": "Write into no parameter.",
      "mechanisms": ["audit"],
      "anchor": { "kind": "file" },
      "cases": { "flag": [{ "name": "push", "fileName": "push.ts", "source": "export const append = (list: number[]): void => {\\n  list.push(1);\\n};\\n", "expectedLines": [2] }], "allow": [{ "name": "copy", "fileName": "copy.ts", "source": "export const append = (list: readonly number[]): readonly number[] => [...list, 1];\\n", "expectedLines": [] }] }
    },
    {
      "kind": "mechanical",
      "id": "parameter-reassignment",
      "summary": "Rebind no parameter.",
      "mechanisms": ["eslint"],
      "anchor": { "kind": "keyword", "keyword": "=" },
      "cases": { "flag": [{ "name": "assign", "fileName": "bump.ts", "source": "export const bump = (count: number): number => {\\n  count = 2;\\n  return count;\\n};\\n", "expectedLines": [2] }], "allow": [{ "name": "new value", "fileName": "next.ts", "source": "export const next = (count: number): number => count + 1;\\n", "expectedLines": [] }] }
    },
    { "kind": "judgement", "id": "parameter-intent", "summary": "Say what a parameter is for.", "enforcedBy": "review" }
  ]
}`;

const WALKER: Engine = { name: "walker", mechanism: mechanismIdSchema.parse("audit") };

const ESLINT: Engine = { name: "eslint", mechanism: mechanismIdSchema.parse("eslint") };

const WRITE_INTO_A_PARAMETER = symptomNamed("write-into-a-parameter");

const REBINDING = symptomNamed("rebinding");

const MUTATION_CLAUSE = clauseAddressSchema.parse("CD-44#parameter-mutation");

const REASSIGNMENT_CLAUSE = clauseAddressSchema.parse("CD-44#parameter-reassignment");

const INTENT_CLAUSE = clauseAddressSchema.parse("CD-44#parameter-intent");

const PARAMETER_CLAUSES: SymptomCatalogue["clauses"] = [
  { clause: MUTATION_CLAUSE, sight: { kind: "one-symptom", symptom: WRITE_INTO_A_PARAMETER } },
  { clause: REASSIGNMENT_CLAUSE, sight: { kind: "one-symptom", symptom: REBINDING } },
  { clause: INTENT_CLAUSE, sight: { kind: "one-symptom", symptom: REBINDING } },
];

const MUTATION_CHECK: Check = { name: "parameter-mutation", symptom: WRITE_INTO_A_PARAMETER, clause: MUTATION_CLAUSE, engines: [WALKER], forms: [] };

const REASSIGNMENT_CHECK: Check = { name: "parameter-reassignment", symptom: REBINDING, clause: REASSIGNMENT_CLAUSE, engines: [ESLINT], forms: [] };

describe("checkCoverageOf", () => {
  it("names nothing when each mechanical clause has its checks, run by the engines of its mechanisms", () => {
    const fileText = fileTextReading({ outcome: "ok", value: CD44_MECHANICAL_TEXT });
    expect(
      checkCoverageOf({
        catalogue: { ...NOTHING_CATALOGUED, engines: [WALKER, ESLINT], symptoms: [WRITE_INTO_A_PARAMETER, REBINDING], clauses: PARAMETER_CLAUSES, checks: [MUTATION_CHECK, REASSIGNMENT_CHECK] },
        fileText,
        path: pathJoiningTo(DISCIPLINE_PATH),
        ruleSetRoot: RULE_SET_ROOT,
        disciplines: ["CD-44"],
      }),
    ).toEqual({ unchecked: [], unmechanical: [], engineMismatches: [] });
    expect(fileText.read).toHaveBeenCalledExactlyOnceWith({ path: DISCIPLINE_PATH });
  });

  it("names a mechanical clause with no check, a check on a judgement clause, and a check run by engines other than its clause's mechanisms", () => {
    expect(
      checkCoverageOf({
        catalogue: {
          ...NOTHING_CATALOGUED,
          engines: [WALKER, ESLINT],
          symptoms: [WRITE_INTO_A_PARAMETER, REBINDING],
          clauses: PARAMETER_CLAUSES,
          checks: [
            { ...MUTATION_CHECK, engines: [WALKER, ESLINT] },
            { name: "parameter-intent", symptom: REBINDING, clause: INTENT_CLAUSE, engines: [WALKER], forms: [] },
          ],
        },
        fileText: fileTextReading({ outcome: "ok", value: CD44_MECHANICAL_TEXT }),
        path: pathJoiningTo(DISCIPLINE_PATH),
        ruleSetRoot: RULE_SET_ROOT,
        disciplines: ["CD-44"],
      }),
    ).toEqual({
      unchecked: ["CD-44#parameter-reassignment"],
      unmechanical: ["rebinding#parameter-intent"],
      engineMismatches: ["write-into-a-parameter#parameter-mutation"],
    });
  });
});

describe("checkAddressTableOf", () => {
  it("lists each check's address beside its clause, in catalogue order", () => {
    expect(checkAddressTableOf({ catalogue: { ...NOTHING_CATALOGUED, checks: [REASSIGNMENT_CHECK, MUTATION_CHECK] } })).toEqual([
      { address: "rebinding#parameter-reassignment", clause: "CD-44#parameter-reassignment" },
      { address: "write-into-a-parameter#parameter-mutation", clause: "CD-44#parameter-mutation" },
    ]);
  });
});

describe("unresolvedAddressesOf", () => {
  it("names nothing when every check's address resolves to it and every clause's checks resolve back to the clause", () => {
    expect(unresolvedAddressesOf({ catalogue: { ...NOTHING_CATALOGUED, clauses: PARAMETER_CLAUSES, checks: [MUTATION_CHECK, REASSIGNMENT_CHECK] } })).toEqual([]);
  });

  it("names an address that resolves to an earlier check holding the same address", () => {
    expect(
      unresolvedAddressesOf({
        catalogue: { ...NOTHING_CATALOGUED, clauses: PARAMETER_CLAUSES, checks: [MUTATION_CHECK, { ...MUTATION_CHECK, clause: REASSIGNMENT_CLAUSE }] },
      }),
    ).toEqual(["write-into-a-parameter#parameter-mutation"]);
  });
});

describe("correctUseNotesOf", () => {
  it("renders the note of each symptom that has a correct use, in catalogue order, and none for a symptom without one", () => {
    expect(
      correctUseNotesOf({
        guide: { guide: "catalogue", catalogue: { ...NOTHING_CATALOGUED, symptoms: [symptomNamed("rebinding"), LOOP_KEYWORD] }, page: "symptoms.md" },
      }),
    ).toEqual([
      "loop-keyword: Loop keyword. May indicate: makes a new value from what it has → One place decides. The breach usually sits in the unit. Draining a stream: an authorised location in its source's adapter (today: authorised-location). Known debt: debt (today: file-carve-out). Read symptoms.md#loop-keyword",
    ]);
  });
});
