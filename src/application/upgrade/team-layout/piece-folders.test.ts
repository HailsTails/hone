import { describe, expect, it, vi } from "vitest";

import { catalogueNameOf } from "../../../domain/language-layer/catalogue-name.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { editionOf } from "../../../domain/rule-set/edition-of.ts";
import { ruleSetNameOf } from "../../../domain/rule-set/rule-set-name-of.ts";
import type {
  ImportsRewrittenOf,
  VersionOnePiece,
} from "../../ports/upgrade/version-one-team-layout.ts";
import { type PieceMember, pieceFolderFilesOf } from "./piece-folders.ts";

const FIRST = editionOf("1");

const ACME = { name: ruleSetNameOf("acme") };

const PIECE: VersionOnePiece = {
  mechanism: "walker",
  settings: { module: "scratch.ts" },
  checkSettings: {},
  editions: { declared: [FIRST], default: FIRST, latest: FIRST },
  folder: repoPathOf("acme/mechanisms/audit/ACME-2"),
  module: repoPathOf("scratch.ts"),
  files: [
    { file: repoPathOf("scratch.ts"), text: 'import "./helpers/pattern.ts";\n' },
    { file: repoPathOf("helpers/pattern.ts"), text: "export const pattern = 1;\n" },
  ],
};

const SCRATCH: PieceMember = {
  clause: {
    ruleSet: ACME,
    discipline: disciplineIdOf("ACME-2"),
    clause: clauseIdOf("scratch-files"),
  },
  check: { symptom: catalogueNameOf("scratch-file"), check: catalogueNameOf("scratch-files") },
  piece: PIECE,
};

const DRAFTS_PIECE: VersionOnePiece = {
  ...PIECE,
  settings: { module: "drafts.ts" },
  module: repoPathOf("drafts.ts"),
  files: [
    ...PIECE.files,
    { file: repoPathOf("drafts.ts"), text: 'import "./helpers/pattern.ts";\n' },
  ],
};

const DRAFTS: PieceMember = {
  clause: {
    ruleSet: ACME,
    discipline: disciplineIdOf("ACME-2"),
    clause: clauseIdOf("draft-files"),
  },
  check: { symptom: catalogueNameOf("scratch-file"), check: catalogueNameOf("draft-files") },
  piece: DRAFTS_PIECE,
};

describe("pieceFolderFilesOf", () => {
  it("moves a folder only one clause uses into that clause's check, each file through the import rewriter", () => {
    const importsRewrittenOf = vi
      .fn<ImportsRewrittenOf>()
      .mockReturnValue({ outcome: "ok", value: "rewritten\n" });
    expect(
      pieceFolderFilesOf({ rootSegments: ["acme"], members: [SCRATCH], importsRewrittenOf }),
    ).toEqual({
      outcome: "ok",
      value: [
        { file: "acme/engines/walker/scratch-file/scratch-files/scratch.ts", text: "rewritten\n" },
        {
          file: "acme/engines/walker/scratch-file/scratch-files/helpers/pattern.ts",
          text: "rewritten\n",
        },
      ],
    });
    expect(importsRewrittenOf).toHaveBeenNthCalledWith(1, {
      text: 'import "./helpers/pattern.ts";\n',
      file: "acme/mechanisms/audit/ACME-2/scratch.ts",
      movedTo: "acme/engines/walker/scratch-file/scratch-files/scratch.ts",
      folder: "acme/mechanisms/audit/ACME-2",
      moved: new Map([
        [
          "acme/mechanisms/audit/ACME-2/scratch.ts",
          "acme/engines/walker/scratch-file/scratch-files/scratch.ts",
        ],
        [
          "acme/mechanisms/audit/ACME-2/helpers/pattern.ts",
          "acme/engines/walker/scratch-file/scratch-files/helpers/pattern.ts",
        ],
      ]),
    });
  });

  it("moves each clause's module to its own check and the shared files once to the clause first by name, with the moved files' imports rewritten", () => {
    expect(
      pieceFolderFilesOf({
        rootSegments: ["acme"],
        members: [
          {
            ...SCRATCH,
            piece: { ...DRAFTS_PIECE, settings: PIECE.settings, module: PIECE.module },
          },
          DRAFTS,
        ],
        importsRewrittenOf: vi
          .fn<ImportsRewrittenOf>()
          .mockReturnValue({ outcome: "ok", value: "rewritten\n" }),
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        { file: "acme/engines/walker/scratch-file/scratch-files/scratch.ts", text: "rewritten\n" },
        {
          file: "acme/engines/walker/scratch-file/draft-files/helpers/pattern.ts",
          text: "rewritten\n",
        },
        { file: "acme/engines/walker/scratch-file/draft-files/drafts.ts", text: "rewritten\n" },
      ],
    });
  });

  it("refuses a folder whose one module serves several clauses, naming the module and the clauses", () => {
    const importsRewrittenOf = vi.fn<ImportsRewrittenOf>();
    expect(
      pieceFolderFilesOf({
        rootSegments: ["acme"],
        members: [SCRATCH, { ...DRAFTS, piece: PIECE }],
        importsRewrittenOf,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "piece-folder-unsplittable",
        folder: "acme/mechanisms/audit/ACME-2",
        split: {
          fault: "module-shared",
          module: "scratch.ts",
          clauses: [DRAFTS.clause, SCRATCH.clause],
        },
      },
    });
    expect(importsRewrittenOf).not.toHaveBeenCalled();
  });

  it("refuses a moved file whose imports the rewriter cannot follow, naming the file and line", () => {
    expect(
      pieceFolderFilesOf({
        rootSegments: ["acme"],
        members: [SCRATCH],
        importsRewrittenOf: vi.fn<ImportsRewrittenOf>().mockReturnValue({
          outcome: "failed",
          error: { reason: "specifier-not-literal", line: 3 },
        }),
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "piece-folder-unsplittable",
        folder: "acme/mechanisms/audit/ACME-2",
        split: {
          fault: "specifier-not-literal",
          file: "acme/mechanisms/audit/ACME-2/scratch.ts",
          line: 3,
        },
      },
    });
  });
});
