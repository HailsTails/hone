import { describe, expect, it, vi } from "vitest";

import { catalogueNameOf } from "../../../domain/language-layer/catalogue-name.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { editionOf } from "../../../domain/rule-set/edition-of.ts";
import type {
  ImportsRewrittenOf,
  VersionOnePiece,
} from "../../ports/upgrade/version-one-team-layout.ts";
import { type PieceMember, pieceFolderFilesOf } from "./piece-folders.ts";

const FIRST = editionOf("1");

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
  clause: clauseIdOf("scratch-files"),
  check: { symptom: catalogueNameOf("scratch-file"), check: catalogueNameOf("scratch-files") },
  piece: PIECE,
};

const DRAFTS: PieceMember = {
  clause: clauseIdOf("draft-files"),
  check: { symptom: catalogueNameOf("scratch-file"), check: catalogueNameOf("draft-files") },
  piece: {
    ...PIECE,
    settings: { module: "drafts.ts" },
    module: repoPathOf("drafts.ts"),
    files: [
      ...PIECE.files,
      { file: repoPathOf("drafts.ts"), text: 'import "./helpers/pattern.ts";\n' },
    ],
  },
};

describe("pieceFolderFilesOf", () => {
  it("moves a folder only one clause uses whole into that clause's check, its text as it was", () => {
    const importsRewrittenOf = vi.fn<ImportsRewrittenOf>();
    expect(
      pieceFolderFilesOf({ rootSegments: ["acme"], members: [SCRATCH], importsRewrittenOf }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          file: "acme/engines/walker/scratch-file/scratch-files/scratch.ts",
          text: 'import "./helpers/pattern.ts";\n',
        },
        {
          file: "acme/engines/walker/scratch-file/scratch-files/helpers/pattern.ts",
          text: "export const pattern = 1;\n",
        },
      ],
    });
    expect(importsRewrittenOf).not.toHaveBeenCalled();
  });

  it("moves each clause's module to its own check and the shared files once to the clause first by name, with the moved files' imports rewritten", () => {
    expect(
      pieceFolderFilesOf({
        rootSegments: ["acme"],
        members: [
          {
            ...SCRATCH,
            piece: { ...DRAFTS.piece, settings: PIECE.settings, module: PIECE.module },
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
        {
          file: "acme/engines/walker/scratch-file/scratch-files/scratch.ts",
          text: "rewritten\n",
        },
        {
          file: "acme/engines/walker/scratch-file/draft-files/helpers/pattern.ts",
          text: "rewritten\n",
        },
        { file: "acme/engines/walker/scratch-file/draft-files/drafts.ts", text: "rewritten\n" },
      ],
    });
  });
});
