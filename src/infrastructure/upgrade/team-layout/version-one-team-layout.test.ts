import { describe, expect, it, vi } from "vitest";

import type {
  DirectoryEntry,
  DirectoryPort,
} from "../../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { VersionOneTeamClause } from "../../../application/ports/upgrade/version-one-team-layout.ts";
import { catalogueNameOf } from "../../../domain/language-layer/catalogue-name.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../../domain/rule-set/rule-set-name-of.ts";
import type { ConsumerSelectionFile } from "../../../domain/settings/selection/selection-file.ts";
import { createPathPort } from "../../node/path-port.ts";
import {
  readVersionOneTeamLayout,
  teamUpgradeNamesOf,
  versionOneTeamLayoutsOf,
} from "./version-one-team-layout.ts";

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const REPO = absoluteRootOf("/repo");

const INSTALL = absoluteRootOf("/install");

const ROOT = absoluteRootOf("/repo/acme");

const ACME = {
  name: ruleSetNameOf("acme"),
  location: { location: "folder", path: repoPathOf("acme") },
} as const;

const DISCIPLINE =
  '{ "version": 1, "id": "ACME-1", "clauses": [{ "kind": "mechanical", "id": "scratch-files", "summary": "no scratch file is committed", "mechanisms": ["audit"], "anchor": { "kind": "file" }, "cases": { "flag": [{ "name": "scratch", "fileName": "src/a.scratch.ts", "source": "x", "expectedLines": [1] }], "allow": [{ "name": "kept", "fileName": "src/a.ts", "source": "x", "expectedLines": [] }] } }, { "kind": "judgement", "id": "naming", "summary": "names say what they hold", "enforcedBy": "review" }] }';

const PIECE =
  '{ "version": 1, "discipline": "ACME-1", "mechanism": "audit", "clauses": [{ "clause": "scratch-files", "settings": { "module": "scratch.ts" } }] }';

const MODULE = "export const check = {};\n";

const NAMES_WITH = (clauses: string): string =>
  `{ "clauses": ${clauses}, "symptoms": { "scratch-file": { "title": "Scratch file", "group": "Repository health", "mayIndicate": [{ "case": "changes-a-repository", "points": [{ "principle": "repository-ready" }] }], "breachUsuallySits": "in the commit", "seenBy": ["files"], "recipes": [], "correctUses": [] } }, "cases": {}, "principles": {}, "rules": {} }`;

const NAMES = NAMES_WITH(
  '{ "ACME-1#scratch-files": { "check": "scratch-file#scratch-files", "title": "Scratch files" } }',
);

const HELPER = "export const scratch = /\\.scratch\\./;\n";

const FILES: Readonly<Record<string, string>> = {
  "/repo/acme/rules/ACME-1/discipline.json": DISCIPLINE,
  "/repo/acme/mechanisms/audit/ACME-1/piece.json": PIECE,
  "/repo/acme/mechanisms/audit/ACME-1/scratch.ts": MODULE,
  "/repo/acme/mechanisms/audit/ACME-1/helpers/pattern.ts": HELPER,
};

const HONE_INSTALL: Readonly<Record<string, string>> = {
  "/install/src/infrastructure/disciplines-file/version-one-names.json":
    '{ "version": 1, "clauses": [], "recordKinds": { "authorised-location": "authorised-location", "debt": "file-carve-out" } }',
  "/install/rules/record-kinds/authorised-location.md":
    '# Authorised location\n\n```json\n{ "phrase": "an authorised location" }\n```\n',
  "/install/rules/record-kinds/debt.md": '# Debt\n\n```json\n{ "phrase": "debt" }\n```\n',
};

const LISTINGS: Readonly<Record<string, readonly DirectoryEntry[]>> = {
  "/install/rules": [{ name: "record-kinds", kind: "directory" }],
  "/install/rules/record-kinds": [
    { name: "authorised-location.md", kind: "file" },
    { name: "debt.md", kind: "file" },
  ],
  "/repo/acme": [
    { name: "mechanisms", kind: "directory" },
    { name: "rules", kind: "directory" },
  ],
  "/repo/acme/rules": [{ name: "ACME-1", kind: "directory" }],
  "/repo/acme/rules/ACME-1": [{ name: "discipline.json", kind: "file" }],
  "/repo/acme/mechanisms/audit/ACME-1": [
    { name: "piece.json", kind: "file" },
    { name: "scratch.ts", kind: "file" },
    { name: "helpers", kind: "directory" },
  ],
  "/repo/acme/mechanisms/audit/ACME-1/helpers": [{ name: "pattern.ts", kind: "file" }],
};

const sourcesListing = (request: {
  readonly files: Readonly<Record<string, string>>;
  readonly listings: Readonly<Record<string, readonly DirectoryEntry[]>>;
}) => {
  const files = { ...HONE_INSTALL, ...request.files };
  const listings = { ...LISTINGS, ...request.listings };
  const fileText: FileTextPort = {
    exists: ({ path }) => (path in files || path in listings ? "present" : "absent"),
    read: ({ path }) => {
      const text = files[path];
      return text === undefined
        ? { outcome: "failed", error: { kind: "unreadable", path, detail: "ENOENT" } }
        : { outcome: "ok", value: text };
    },
    write: vi.fn<FileTextPort["write"]>(),
  };
  const directory: DirectoryPort = {
    list: ({ path }) => ({ outcome: "ok", value: listings[path] ?? [] }),
    create: vi.fn<DirectoryPort["create"]>(),
  };
  return { fileText, directory, path: PATH, repoRoot: REPO, installRoot: INSTALL };
};

const sourcesHolding = (files: Readonly<Record<string, string>>) =>
  sourcesListing({ files, listings: {} });

const SCRATCH_CLAUSE = {
  ruleSet: { name: "acme" },
  discipline: "ACME-1",
  clause: "scratch-files",
};

const SCRATCH_CLAUSE_ADDRESS = {
  ruleSet: { name: ruleSetNameOf("acme") },
  discipline: disciplineIdOf("ACME-1"),
  clause: clauseIdOf("scratch-files"),
};

const UNNAMED_CLAUSE: VersionOneTeamClause = {
  clause: { ...SCRATCH_CLAUSE_ADDRESS, clause: clauseIdOf("draft-files") },
  naming: { naming: "unnamed" },
  summary: "no draft file is committed",
  anchor: { kind: "file" },
  exceptions: "allowed",
  cases: { flag: [], allow: [] },
  pieces: [],
};

const SCRATCH = {
  clause: SCRATCH_CLAUSE,
  naming: {
    naming: "named",
    check: { symptom: "scratch-file", check: "scratch-files" },
    title: "Scratch files",
  },
  summary: "no scratch file is committed",
  anchor: { kind: "file" },
  exceptions: "allowed",
  cases: {
    flag: [{ name: "scratch", fileName: "src/a.scratch.ts", source: "x", expectedLines: [1] }],
    allow: [{ name: "kept", fileName: "src/a.ts", source: "x", expectedLines: [] }],
  },
  pieces: [
    {
      mechanism: "walker",
      settings: { module: "scratch.ts" },
      checkSettings: {},
      editions: { declared: ["1"], default: "1", latest: "1" },
      folder: "acme/mechanisms/audit/ACME-1",
      module: "scratch.ts",
      files: [
        { file: "scratch.ts", text: MODULE },
        { file: "helpers/pattern.ts", text: HELPER },
      ],
    },
  ],
};

const LAYOUT = {
  ruleSet: { name: "acme" },
  location: { location: "folder", path: "acme" },
  namesFile: "acme/version-two-names.json",
  clauses: [SCRATCH],
  definitions: [
    {
      kind: "symptom",
      name: "scratch-file",
      title: "Scratch file",
      facts: {
        group: "Repository health",
        mayIndicate: [
          { case: "changes-a-repository", points: [{ principle: "repository-ready" }] },
        ],
        breachUsuallySits: "in the commit",
        seenBy: ["files"],
        recipes: [],
        correctUses: [],
      },
      refers: [
        { kind: "case", name: "changes-a-repository" },
        { kind: "principle", name: "repository-ready" },
      ],
    },
  ],
  versionOneFiles: ["acme/rules/ACME-1/discipline.json", "acme/mechanisms/audit/ACME-1/piece.json"],
};

describe("readVersionOneTeamLayout", () => {
  it("reads each mechanical clause with its name, summary, cases and piece, every file of the piece's folder, the team's definitions, and the version 1 files", () => {
    expect(
      readVersionOneTeamLayout({
        ...sourcesHolding({ ...FILES, "/repo/acme/version-two-names.json": NAMES }),
        ruleSet: ACME,
        root: ROOT,
      }),
    ).toEqual({ outcome: "ok", value: LAYOUT });
  });

  it("leaves a clause unnamed when the rule set holds no names file", () => {
    expect(
      readVersionOneTeamLayout({ ...sourcesHolding(FILES), ruleSet: ACME, root: ROOT }),
    ).toEqual({
      outcome: "ok",
      value: {
        ...LAYOUT,
        clauses: [{ ...SCRATCH, naming: { naming: "unnamed" } }],
        definitions: [],
      },
    });
  });

  it("refuses a name given to no mechanical clause of the rule set", () => {
    expect(
      readVersionOneTeamLayout({
        ...sourcesHolding({
          ...FILES,
          "/repo/acme/version-two-names.json": NAMES_WITH(
            '{ "ACME-1#scratch-files": { "check": "scratch-file#scratch-files", "title": "Scratch files" }, "ACME-1#naming": { "check": "naming#naming", "title": "Naming" } }',
          ),
        }),
        ruleSet: ACME,
        root: ROOT,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "rule-set-invalid",
        path: "/repo/acme/version-two-names.json",
        detail: "ACME-1#naming names no mechanical clause of rule set acme",
      },
    });
  });
  it("reads a piece folder several clauses share as each clause's piece, with that clause's own module", () => {
    const sharing =
      '{ "version": 1, "id": "ACME-1", "clauses": [{ "kind": "mechanical", "id": "scratch-files", "summary": "no scratch file is committed", "mechanisms": ["audit"], "anchor": { "kind": "file" }, "cases": { "flag": [{ "name": "scratch", "fileName": "src/a.scratch.ts", "source": "x", "expectedLines": [1] }], "allow": [{ "name": "kept", "fileName": "src/a.ts", "source": "x", "expectedLines": [] }] } }, { "kind": "mechanical", "id": "draft-files", "summary": "no draft file is committed", "mechanisms": ["audit"], "anchor": { "kind": "file" }, "cases": { "flag": [{ "name": "scratch", "fileName": "src/a.scratch.ts", "source": "x", "expectedLines": [1] }], "allow": [{ "name": "kept", "fileName": "src/a.ts", "source": "x", "expectedLines": [] }] } }] }';
    const sharedPiece =
      '{ "version": 1, "discipline": "ACME-1", "mechanism": "audit", "clauses": [{ "clause": "scratch-files", "settings": { "module": "scratch.ts" } }, { "clause": "draft-files", "settings": { "module": "helpers/pattern.ts" } }] }';
    expect(
      readVersionOneTeamLayout({
        ...sourcesHolding({
          ...FILES,
          "/repo/acme/rules/ACME-1/discipline.json": sharing,
          "/repo/acme/mechanisms/audit/ACME-1/piece.json": sharedPiece,
        }),
        ruleSet: ACME,
        root: ROOT,
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        clauses: [
          {
            clause: SCRATCH_CLAUSE,
            pieces: [{ folder: "acme/mechanisms/audit/ACME-1", module: "scratch.ts" }],
          },
          {
            clause: { ...SCRATCH_CLAUSE, clause: "draft-files" },
            pieces: [{ folder: "acme/mechanisms/audit/ACME-1", module: "helpers/pattern.ts" }],
          },
        ],
      },
    });
  });

  it("refuses a piece whose settings name no module", () => {
    expect(
      readVersionOneTeamLayout({
        ...sourcesHolding({
          ...FILES,
          "/repo/acme/mechanisms/audit/ACME-1/piece.json":
            '{ "version": 1, "discipline": "ACME-1", "mechanism": "audit", "clauses": [{ "clause": "scratch-files", "settings": {} }] }',
        }),
        ruleSet: ACME,
        root: ROOT,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "rule-set-invalid",
        path: "/repo/acme/mechanisms/audit/ACME-1/piece.json",
        detail: "the settings of scratch-files name no piece module",
      },
    });
  });
});

describe("teamUpgradeNamesOf", () => {
  it("links each named clause to its check and its one symptom", () => {
    const names = teamUpgradeNamesOf({
      layout: {
        ruleSet: { name: ruleSetNameOf("acme") },
        location: { location: "folder", path: repoPathOf("acme") },
        namesFile: repoPathOf("acme/version-two-names.json"),
        clauses: [
          {
            clause: SCRATCH_CLAUSE_ADDRESS,
            naming: {
              naming: "named",
              check: {
                symptom: catalogueNameOf("scratch-file"),
                check: catalogueNameOf("scratch-files"),
              },
              title: "Scratch files",
            },
            summary: "no scratch file is committed",
            anchor: { kind: "file" },
            exceptions: "allowed",
            cases: { flag: [], allow: [] },
            pieces: [],
          },
          UNNAMED_CLAUSE,
        ],
        definitions: [],
        versionOneFiles: [],
      },
      namesPath: "/repo/acme/version-two-names.json",
    });
    expect(names).toMatchObject({
      outcome: "ok",
      value: {
        clauses: [
          {
            clause: SCRATCH_CLAUSE,
            sight: { kind: "one-symptom", symptom: "scratch-file" },
          },
        ],
        clauseOfCheck: new Map([["scratch-file#scratch-files", SCRATCH_CLAUSE]]),
      },
    });
  });
});

const SELECTION: ConsumerSelectionFile = {
  version: 1,
  ruleSets: [[ruleSetNameOf("acme"), { location: "folder", path: repoPathOf("acme") }]],
  clauses: [],
  exclude: [],
  eslintConfigRoots: [],
  fileExceptionWhyChains: "required",
  reportOutput: "full",
  assessment: { forfeiture: "this-run" },
  clauseSettings: [],
  checkEditions: "pinned",
};

describe("versionOneTeamLayoutsOf", () => {
  it("reads the layout of a used team rule set still in the version 1 layout", () => {
    expect(
      versionOneTeamLayoutsOf({
        ...sourcesHolding({ ...FILES, "/repo/acme/version-two-names.json": NAMES }),
        selection: {
          ...SELECTION,
          clauses: [[SCRATCH_CLAUSE_ADDRESS, { state: "run", mechanism: "walker" }]],
        },
      }),
    ).toEqual({ outcome: "ok", value: [LAYOUT] });
  });

  it("refuses a used team rule set whose version 1 discipline files sit beside version 2 items, naming the files a stopped upgrade left", () => {
    expect(
      versionOneTeamLayoutsOf({
        ...sourcesListing({
          files: {
            ...FILES,
            "/repo/acme/rules/principles/repository-ready.md":
              "# Repository ready\n\n```json\n{}\n```\n",
          },
          listings: {
            "/repo/acme/rules": [
              { name: "ACME-1", kind: "directory" },
              { name: "principles", kind: "directory" },
            ],
            "/repo/acme/rules/principles": [{ name: "repository-ready.md", kind: "file" }],
          },
        }),
        selection: {
          ...SELECTION,
          clauses: [[SCRATCH_CLAUSE_ADDRESS, { state: "run", mechanism: "walker" }]],
        },
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "rule-set-half-upgraded",
        path: "/repo/acme",
        files: ["/repo/acme/rules/ACME-1/discipline.json"],
      },
    });
  });

  it("reads no team rule set the selection does not use", () => {
    expect(versionOneTeamLayoutsOf({ ...sourcesHolding(FILES), selection: SELECTION })).toEqual({
      outcome: "ok",
      value: [],
    });
  });
});
