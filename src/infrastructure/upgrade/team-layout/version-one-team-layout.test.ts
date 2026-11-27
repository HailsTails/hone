import { describe, expect, it, vi } from "vitest";

import type {
  DirectoryEntry,
  DirectoryPort,
} from "../../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { VersionOneTeamClause } from "../../../application/ports/upgrade/version-one-team-layout.ts";
import { catalogueNameOf } from "../../../domain/language-layer/catalogue-name.ts";
import type { RecordKind } from "../../../domain/language-layer/symptom-catalogue.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../../domain/rule-set/rule-set-name-of.ts";
import type { ConsumerSelectionFile } from "../../../domain/settings/selection/selection-file.ts";
import { createPathPort } from "../../node/path-port.ts";
import { readVersionOneTeamLayout, versionOneTeamLayoutsOf } from "./version-one-team-layout.ts";

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

type FileReads = Readonly<Record<string, ReturnType<FileTextPort["read"]>>>;

const FILES: FileReads = {
  "/repo/acme/rules/ACME-1/discipline.json": { outcome: "ok", value: DISCIPLINE },
  "/repo/acme/mechanisms/audit/ACME-1/piece.json": { outcome: "ok", value: PIECE },
  "/repo/acme/mechanisms/audit/ACME-1/scratch.ts": { outcome: "ok", value: MODULE },
  "/repo/acme/mechanisms/audit/ACME-1/helpers/pattern.ts": { outcome: "ok", value: HELPER },
};

const TOOL_RECORD_KINDS: readonly RecordKind[] = [
  {
    name: "authorised-location",
    title: "Authorised location",
    phrase: "an authorised location",
    todaysFormat: "authorised-location",
  },
  { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" },
];

const LISTINGS: Readonly<Record<string, readonly DirectoryEntry[]>> = {
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
  readonly files: FileReads;
  readonly extraPresent?: Readonly<Record<string, "present">>;
  readonly listings: Readonly<Record<string, readonly DirectoryEntry[]>>;
}) => {
  const { files } = request;
  const listings = { ...LISTINGS, ...request.listings };
  const present: Readonly<Record<string, "present" | "absent">> = {
    "/repo/acme": "present",
    "/repo/acme/rules": "present",
    "/repo/acme/rules/ACME-1": "present",
    "/repo/acme/rules/ACME-1/discipline.json": "present",
    "/repo/acme/mechanisms/audit/ACME-1": "present",
    "/repo/acme/mechanisms/audit/ACME-1/piece.json": "present",
    "/repo/acme/mechanisms/audit/ACME-1/scratch.ts": "present",
    "/repo/acme/mechanisms/audit/ACME-1/helpers": "present",
    "/repo/acme/mechanisms/audit/ACME-1/helpers/pattern.ts": "present",
    ...request.extraPresent,
  };
  const exists: FileTextPort["exists"] = ({ path }) => {
    const { [path]: presence = "absent" } = present;
    return presence;
  };
  const read: FileTextPort["read"] = ({ path }) => {
    const missing: ReturnType<FileTextPort["read"]> = {
      outcome: "failed",
      error: { kind: "unreadable", path, detail: "ENOENT" },
    };
    const { [path]: document = missing } = files;
    return document;
  };
  const list: DirectoryPort["list"] = ({ path }) => {
    const { [path]: entries = [] } = listings;
    return { outcome: "ok", value: entries };
  };
  const fileText: FileTextPort = { exists, read, write: vi.fn<FileTextPort["write"]>() };
  const directory: DirectoryPort = { list, create: vi.fn<DirectoryPort["create"]>() };
  return {
    fileText,
    directory,
    path: PATH,
    repoRoot: REPO,
    installRoot: INSTALL,
    toolRecordKinds: TOOL_RECORD_KINDS,
  };
};

const sourcesHolding = (files: FileReads, extraPresent?: Readonly<Record<string, "present">>) =>
  sourcesListing({ files, listings: {}, extraPresent });

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
        ...sourcesHolding(
          { ...FILES, "/repo/acme/version-two-names.json": { outcome: "ok", value: NAMES } },
          { "/repo/acme/version-two-names.json": "present" },
        ),
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
        ...sourcesHolding(
          {
            ...FILES,
            "/repo/acme/version-two-names.json": {
              outcome: "ok",
              value: NAMES_WITH(
                '{ "ACME-1#scratch-files": { "check": "scratch-file#scratch-files", "title": "Scratch files" }, "ACME-1#naming": { "check": "naming#naming", "title": "Naming" } }',
              ),
            },
          },
          { "/repo/acme/version-two-names.json": "present" },
        ),
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
          "/repo/acme/rules/ACME-1/discipline.json": { outcome: "ok", value: sharing },
          "/repo/acme/mechanisms/audit/ACME-1/piece.json": { outcome: "ok", value: sharedPiece },
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

  it("refuses Oxlint as a version one piece mechanism", () => {
    const layout = readVersionOneTeamLayout({
      ...sourcesHolding({
        ...FILES,
        "/repo/acme/mechanisms/audit/ACME-1/piece.json": {
          outcome: "ok",
          value:
            '{ "version": 1, "discipline": "ACME-1", "mechanism": "oxlint", "clauses": [{ "clause": "scratch-files", "settings": { "module": "check.ts" } }] }',
        },
      }),
      ruleSet: ACME,
      root: ROOT,
    });

    expect(layout).toMatchObject({
      outcome: "failed",
      error: { path: "/repo/acme/mechanisms/audit/ACME-1/piece.json" },
    });
  });

  it("refuses a piece whose settings name no module", () => {
    expect(
      readVersionOneTeamLayout({
        ...sourcesHolding({
          ...FILES,
          "/repo/acme/mechanisms/audit/ACME-1/piece.json": {
            outcome: "ok",
            value:
              '{ "version": 1, "discipline": "ACME-1", "mechanism": "audit", "clauses": [{ "clause": "scratch-files", "settings": {} }] }',
          },
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
        ...sourcesHolding(
          { ...FILES, "/repo/acme/version-two-names.json": { outcome: "ok", value: NAMES } },
          { "/repo/acme/version-two-names.json": "present" },
        ),
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
            "/repo/acme/rules/principles/repository-ready.md": {
              outcome: "ok",
              value: "# Repository ready\n\n```json\n{}\n```\n",
            },
          },
          extraPresent: {
            "/repo/acme/rules/principles": "present",
            "/repo/acme/rules/principles/repository-ready.md": "present",
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
