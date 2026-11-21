import { describe, expect, it, vi } from "vitest";
import type { ExceptionRecord } from "../../../../../domain/records/discipline-exceptions/exception-record.ts";
import { createPathPort } from "../../../../node/path-port.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { clauseAddressSchema } from "../../../../discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../../../hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import type { VersionOneWhyChain } from "../../../../../domain/records/discipline-exceptions/version-one-why-chain.ts";
import type { CurrentProjection, ProjectionFiles } from "../projection/projection.ts";
import { projectionText } from "../projection/projection-text.ts";
import type { ProjectionStates } from "../projection/projection-states.ts";
import type { ConfigRoot } from "./projection-slices.ts";
import {
  packageSliceProblemsOf,
  type ProjectionClause,
  type SliceOrigin,
  slicedProjectionWrites,
  sliceTextOf,
} from "./sliced-projection.ts";

const VERSION_ONE_CAUSAL_WHY_CHAIN: VersionOneWhyChain = {
  whys: [
    {
      why: "Why does the audit refuse tracker ids in carve-out names?",
      because: "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
      evidence: "tools/audit/name-matcher.ts:14",
    },
    {
      why: "Why does the name matcher accept only lowercase slugs?",
      because: "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
      evidence: "tools/git/branch-name.ts:8",
    },
    {
      why: "Why was the matcher copied from the branch-name validator?",
      because: "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
      evidence: "PR #212, merged 2026-07-02",
    },
    {
      why: "Why did no shared slug type exist when the audit landed?",
      because: "The values package that now holds RepoPath was split out two months after the audit.",
      evidence: "packages/values/package.json:3",
    },
    {
      why: "Why was the values package split out after the audit?",
      because: "The split waited on the monorepo move, which left older tools on their own patterns.",
      evidence: "docs/decisions/0007-monorepo.md:21",
    },
  ],
  rootCause: "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  rootCheck: "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};

const classSyntax = clauseAddressSchema.parse("CD-14#class-syntax");
const eslint = mechanismIdSchema.parse("eslint");

const CLASS_CLAUSE: ProjectionClause = {
  address: classSyntax,
  ruleId: "hone/no-class-authoring",
  options: [],
  pluginNamespace: "hone",
  pieceRoot: "/repo/mechanisms/eslint/CD-14",
  pluginModule: "cd14.eslint-plugin.ts",
};

const ORIGIN: SliceOrigin = {
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
  repoRoot: absolutePathSchema.parse("/repo"),
  install: { form: "source" },
};

const WINDOWS_ORIGIN: SliceOrigin = {
  path: createPathPort({ flavour: "windows", workingDirectory: () => "C:\\repo" }),
  repoRoot: absolutePathSchema.parse("C:\\repo"),
  install: { form: "source" },
};

const REPOSITORY: ConfigRoot = { placement: "repository" };
const PACKAGE_A: ConfigRoot = { placement: "package", directory: repoPathSchema.parse("packages/a") };

const carveOutInLegacy: ExceptionRecord = {
  kind: "file-carve-out",
  clause: classSyntax,
  mechanism: eslint,
  file: repoPathSchema.parse("packages/a/src/legacy.ts"),
  reason: "Inherited class awaiting paydown",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const authorisedInRootSource: ExceptionRecord = {
  kind: "authorised-location",
  provenance: {
    kind: "existing-authorisation",
    source: "fictional unit fixture mechanisms/eslint/runner/sliced-projection.test.ts; not historical authorisation",
  },
  clause: classSyntax,
  mechanism: eslint,
  file: repoPathSchema.parse("src/adapter.ts"),
  reason: "Structural location for the vendor adapter",
};

const PACKAGE_PIECE = {
  pluginNamespace: "hone",
  pluginImport: "../../mechanisms/eslint/CD-14/cd14.eslint-plugin.ts",
  clauses: [{ address: classSyntax, ruleId: "hone/no-class-authoring", options: [] }],
};

const PACKAGE_A_SLICE = projectionText({
  selectedPieces: [PACKAGE_PIECE],
  records: [{ ...carveOutInLegacy, file: repoPathSchema.parse("src/legacy.ts") }],
});

const EMPTY_PACKAGE_SLICE = projectionText({ selectedPieces: [PACKAGE_PIECE], records: [] });

const ABSENT: CurrentProjection = { presence: "absent" };

const present = (text: string): CurrentProjection => ({ presence: "present", text });

const REPOSITORY_PROJECTION = repoPathSchema.parse("disciplines.eslint.mjs");

const PACKAGE_A_SLICE_FILE = repoPathSchema.parse("packages/a/disciplines.eslint.mjs");

const OLD_SLICE_FILE = repoPathSchema.parse("packages/old/disciplines.eslint.mjs");

const projectionFilesHolding = (states: ProjectionStates) => ({
  currentOf: vi.fn<ProjectionFiles["currentOf"]>().mockReturnValue({ outcome: "ok", value: states }),
  writeAt: vi.fn<ProjectionFiles["writeAt"]>().mockReturnValue({ outcome: "ok", value: { path: REPOSITORY_PROJECTION, effect: "written" } }),
  removeAt: vi.fn<ProjectionFiles["removeAt"]>().mockReturnValue({ outcome: "ok", value: undefined }),
});

describe("sliceTextOf", () => {
  it("imports the plugin relative to the package folder and keeps only that package's records, re-pathed to it", () => {
    expect(
      sliceTextOf({
        clauses: [CLASS_CLAUSE],
        records: [carveOutInLegacy, authorisedInRootSource],
        origin: ORIGIN,
        root: PACKAGE_A,
      }),
    ).toEqual({ outcome: "ok", value: PACKAGE_A_SLICE });
  });

  it("gives the repository root every record with root-relative paths and a root-relative import", () => {
    expect(
      sliceTextOf({ clauses: [CLASS_CLAUSE], records: [carveOutInLegacy, authorisedInRootSource], origin: ORIGIN, root: REPOSITORY }),
    ).toEqual({
      outcome: "ok",
      value: projectionText({
        selectedPieces: [{ ...PACKAGE_PIECE, pluginImport: "./mechanisms/eslint/CD-14/cd14.eslint-plugin.ts" }],
        records: [carveOutInLegacy, authorisedInRootSource],
      }),
    });
  });

  it("is piece-invalid when the piece is on another drive from the package it would be imported into", () => {
    expect(
      sliceTextOf({
        clauses: [{ ...CLASS_CLAUSE, pieceRoot: "D:\\pieces\\CD-14" }],
        records: [],
        origin: WINDOWS_ORIGIN,
        root: PACKAGE_A,
      }),
    ).toMatchObject({ outcome: "failed", error: { kind: "piece-invalid", pieceRoot: "D:\\pieces\\CD-14" } });
  });
});

describe("packageSliceProblemsOf", () => {
  it("names a package slice that is absent as missing", () => {
    expect(
      packageSliceProblemsOf({
        clauses: [CLASS_CLAUSE],
        records: [carveOutInLegacy],
        origin: ORIGIN,
        projectionFiles: projectionFilesHolding(new Map([[PACKAGE_A_SLICE_FILE, ABSENT]])),
        roots: [REPOSITORY, PACKAGE_A],
      }),
    ).toEqual({ outcome: "ok", value: [{ slice: "packages/a/disciplines.eslint.mjs", state: "missing" }] });
  });

  it("fails as the projection files fail when the package slices cannot be read", () => {
    expect(
      packageSliceProblemsOf({
        clauses: [CLASS_CLAUSE],
        records: [carveOutInLegacy],
        origin: ORIGIN,
        projectionFiles: {
          ...projectionFilesHolding(new Map()),
          currentOf: vi.fn<ProjectionFiles["currentOf"]>().mockReturnValue({
            outcome: "failed",
            error: { kind: "file-unreadable", file: PACKAGE_A_SLICE_FILE, detail: "EACCES" },
          }),
        },
        roots: [REPOSITORY, PACKAGE_A],
      }),
    ).toEqual({ outcome: "failed", error: { kind: "file-unreadable", file: "packages/a/disciplines.eslint.mjs", detail: "EACCES" } });
  });

  it("names a package slice whose bytes differ from its generation as out-of-date", () => {
    expect(
      packageSliceProblemsOf({
        clauses: [CLASS_CLAUSE],
        records: [carveOutInLegacy],
        origin: ORIGIN,
        projectionFiles: projectionFilesHolding(new Map([[PACKAGE_A_SLICE_FILE, present(EMPTY_PACKAGE_SLICE)]])),
        roots: [REPOSITORY, PACKAGE_A],
      }),
    ).toEqual({ outcome: "ok", value: [{ slice: "packages/a/disciplines.eslint.mjs", state: "out-of-date" }] });
  });

  it("names nothing and asks for no slice when no config root is a package", () => {
    const projectionFiles = projectionFilesHolding(new Map());
    expect(
      packageSliceProblemsOf({ clauses: [CLASS_CLAUSE], records: [], origin: ORIGIN, projectionFiles, roots: [REPOSITORY] }),
    ).toEqual({ outcome: "ok", value: [] });
    expect(projectionFiles.currentOf).not.toHaveBeenCalled();
  });

  it("names nothing for a current package slice and never reads or names the repository root's projection", () => {
    const projectionFiles = projectionFilesHolding(new Map([[PACKAGE_A_SLICE_FILE, present(PACKAGE_A_SLICE)]]));
    expect(
      packageSliceProblemsOf({
        clauses: [CLASS_CLAUSE],
        records: [carveOutInLegacy],
        origin: ORIGIN,
        projectionFiles,
        roots: [REPOSITORY, PACKAGE_A],
      }),
    ).toEqual({ outcome: "ok", value: [] });
    expect(projectionFiles.currentOf).toHaveBeenCalledExactlyOnceWith({ files: [PACKAGE_A_SLICE_FILE] });
  });
});

describe("slicedProjectionWrites over the config roots", () => {
  it("asks once for the state of every config root's slice", () => {
    const projectionFiles = projectionFilesHolding(new Map());

    slicedProjectionWrites({
      clauses: [CLASS_CLAUSE],
      records: [],
      origin: ORIGIN,
      projectionFiles,
      roots: [REPOSITORY, PACKAGE_A],
      trackedPaths: [OLD_SLICE_FILE],
    });

    expect(projectionFiles.currentOf).toHaveBeenCalledExactlyOnceWith({
      files: [REPOSITORY_PROJECTION, PACKAGE_A_SLICE_FILE, OLD_SLICE_FILE],
    });
  });

  it("writes one slice per config root, the repository root first, each at its own folder", () => {
    const projectionFiles = {
      ...projectionFilesHolding(new Map()),
      writeAt: vi
        .fn<ProjectionFiles["writeAt"]>()
        .mockReturnValueOnce({ outcome: "ok", value: { path: REPOSITORY_PROJECTION, effect: "written" } })
        .mockReturnValueOnce({ outcome: "ok", value: { path: repoPathSchema.parse("packages/a/disciplines.eslint.mjs"), effect: "written" } }),
    };

    expect({
      result: slicedProjectionWrites({
        clauses: [CLASS_CLAUSE],
        records: [carveOutInLegacy],
        origin: ORIGIN,
        projectionFiles,
        roots: [REPOSITORY, PACKAGE_A],
        trackedPaths: [],
      }),
      written: projectionFiles.writeAt.mock.calls,
    }).toEqual({
      result: {
        outcome: "ok",
        value: [
          { path: "disciplines.eslint.mjs", effect: "written" },
          { path: "packages/a/disciplines.eslint.mjs", effect: "written" },
        ],
      },
      written: [
        [{ file: "disciplines.eslint.mjs", text: expect.any(String) }],
        [{ file: "packages/a/disciplines.eslint.mjs", text: PACKAGE_A_SLICE }],
      ],
    });
  });
});

describe("slicedProjectionWrites over tracked slices outside every config root", () => {
  it("removes a tracked slice whose folder is no longer a config root when its bytes are exactly what Hone would write there", () => {
    const projectionFiles = projectionFilesHolding(new Map([[OLD_SLICE_FILE, present(EMPTY_PACKAGE_SLICE)]]));

    expect({
      result: slicedProjectionWrites({
        clauses: [CLASS_CLAUSE],
        records: [],
        origin: ORIGIN,
        projectionFiles,
        roots: [REPOSITORY],
        trackedPaths: [OLD_SLICE_FILE],
      }),
      removed: projectionFiles.removeAt.mock.calls,
    }).toEqual({
      result: {
        outcome: "ok",
        value: [
          { path: "disciplines.eslint.mjs", effect: "written" },
          { path: "packages/old/disciplines.eslint.mjs", effect: "removed" },
        ],
      },
      removed: [[{ file: "packages/old/disciplines.eslint.mjs" }]],
    });
  });

  it("leaves a tracked slice outside every config root in place when its bytes are not what Hone would write", () => {
    const projectionFiles = projectionFilesHolding(new Map([[OLD_SLICE_FILE, present("export default [];\n")]]));

    expect({
      result: slicedProjectionWrites({
        clauses: [CLASS_CLAUSE],
        records: [],
        origin: ORIGIN,
        projectionFiles,
        roots: [REPOSITORY],
        trackedPaths: [OLD_SLICE_FILE],
      }),
      removed: projectionFiles.removeAt.mock.calls,
    }).toEqual({
      result: {
        outcome: "ok",
        value: [
          { path: "disciplines.eslint.mjs", effect: "written" },
          { path: "packages/old/disciplines.eslint.mjs", effect: "left-in-place" },
        ],
      },
      removed: [],
    });
  });
});

describe("slicedProjectionWrites when a stale slice cannot be removed", () => {
  it("fails as the projection files fail when a stale slice cannot be removed", () => {
    expect(
      slicedProjectionWrites({
        clauses: [CLASS_CLAUSE],
        records: [],
        origin: ORIGIN,
        projectionFiles: {
          ...projectionFilesHolding(new Map([[OLD_SLICE_FILE, present(EMPTY_PACKAGE_SLICE)]])),
          removeAt: vi.fn<ProjectionFiles["removeAt"]>().mockReturnValue({
            outcome: "failed",
            error: { kind: "tool-failed", detail: "EPERM" },
          }),
        },
        roots: [REPOSITORY],
        trackedPaths: [OLD_SLICE_FILE],
      }),
    ).toEqual({ outcome: "failed", error: { kind: "tool-failed", detail: "EPERM" } });
  });
});

describe("slicedProjectionWrites on Windows paths", () => {
  it("writes a package slice at its repository path, importing the piece by a forward-slash path from the package folder", () => {
    const projectionFiles = projectionFilesHolding(new Map());

    slicedProjectionWrites({
      clauses: [{ ...CLASS_CLAUSE, pieceRoot: "C:\\repo\\mechanisms\\eslint\\CD-14" }],
      records: [],
      origin: WINDOWS_ORIGIN,
      projectionFiles,
      roots: [PACKAGE_A],
      trackedPaths: [],
    });

    expect(projectionFiles.writeAt.mock.calls).toEqual([[{ file: "packages/a/disciplines.eslint.mjs", text: EMPTY_PACKAGE_SLICE }]]);
  });
});
