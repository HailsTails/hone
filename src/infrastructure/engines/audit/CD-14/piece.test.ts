import { assert, describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../../application/ports/host/path-port.ts";
import { readPieceFile } from "../../../content-files/rule-sets/rule-set-reader.ts";
import type { DisciplineFile } from "../../../../domain/rule-set/rule-set-types.ts";
import { walkerPieceSettingsSchema } from "../runner/pieces/walker-check-schema.ts";
import piece from "./piece.json" with { type: "json" };
import { absoluteRootOf } from "../../../../domain/repository/absolute-root-of.ts";
import { clauseIdOf } from "../../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../../domain/rule-set/discipline-id-of.ts";

const fileText: FileTextPort = {
  read: () => ({ outcome: "ok", value: JSON.stringify(piece) }),
  exists: () => "present",
  write: () => ({ outcome: "ok", value: undefined }),
};

const JOINED_PATHS: Readonly<Record<string, string>> = {
  '["/install","src","infrastructure","engines","audit","CD-14","piece.json"]':
    "/install/src/infrastructure/engines/audit/CD-14/piece.json",
};

const TABLE_PATH: PathPort = {
  join: ({ segments }) => {
    const joined = JOINED_PATHS[JSON.stringify(segments)];
    assert(joined !== undefined, `the fake table holds no entry for ${JSON.stringify(segments)}`);
    return joined;
  },
  relative: vi.fn<PathPort["relative"]>(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};

const CD14: DisciplineFile = {
  version: 1,
  id: disciplineIdOf("CD-14"),
  clauses: [
    {
      kind: "judgement",
      id: clauseIdOf("class-syntax"),
      enforcedBy: "review",
    },
  ],
};

describe("CD-14 audit piece.json", () => {
  it("loads as the audit's CD-14 piece pointing class-syntax at its check module", () => {
    expect(
      readPieceFile({
        fileText,
        path: TABLE_PATH,
        ruleSetRoot: absoluteRootOf("/install"),
        installRoot: absoluteRootOf("/install"),
        mechanism: "audit",
        discipline: CD14,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        version: 1,
        discipline: "CD-14",
        mechanism: "audit",
        clauses: [{ clause: "class-syntax", settings: { module: "class-syntax.ts" }, clauseSettings: {}, editions: { declared: ["1"], default: "1", latest: "1" } }],
      },
    });
  });

  it("holds settings the audit runner accepts", () => {
    expect(walkerPieceSettingsSchema.safeParse(piece.clauses[0].settings)).toEqual({
      success: true,
      data: { module: "class-syntax.ts" },
    });
  });
});
