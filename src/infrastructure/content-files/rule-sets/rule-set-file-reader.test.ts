import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import { createPathPort } from "../../node/path-port.ts";
import { createRuleSetFileReader } from "./rule-set-file-reader.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const INSTALL_ROOT = absoluteRootOf("/install");

const TEAM_ROOT = absoluteRootOf("/repo/team-rules");

const TM_1_TEXT = '{ "version": 1, "id": "TM-1", "clauses": [{ "kind": "judgement", "id": "naming", "summary": "names say what they hold", "enforcedBy": "review" }] }';

const PIECE_TEXT = '{ "version": 1, "discipline": "TM-1", "mechanism": "audit", "clauses": [] }';

describe("createRuleSetFileReader", () => {
  it("reads a held discipline through the rule set's discipline reader", () => {
    const reader = createRuleSetFileReader({
      fileText: {
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present"),
        read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "ok", value: TM_1_TEXT }),
        write: vi.fn<FileTextPort["write"]>(),
      },
      path: PATH,
    });
    expect(reader.disciplineFile({ ruleSetRoot: TEAM_ROOT, installRoot: INSTALL_ROOT, discipline: disciplineIdOf("TM-1") })).toEqual({
      outcome: "ok",
      value: { held: "present", file: { version: 1, id: "TM-1", clauses: [{ kind: "judgement", id: "naming", enforcedBy: "review" }] } },
    });
  });

  it("reads a piece file under the rule set's mechanisms folder", () => {
    const read = vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "ok", value: PIECE_TEXT });
    const reader = createRuleSetFileReader({ fileText: { exists: vi.fn<FileTextPort["exists"]>(), read, write: vi.fn<FileTextPort["write"]>() }, path: PATH });
    expect(
      reader.pieceFile({
        ruleSetRoot: TEAM_ROOT,
        installRoot: INSTALL_ROOT,
        mechanism: "audit",
        discipline: { version: 1, id: disciplineIdOf("TM-1"), clauses: [] },
      }),
    ).toMatchObject({ outcome: "ok", value: { discipline: "TM-1", mechanism: "audit", clauses: [] } });
    expect(read.mock.calls).toEqual([[{ path: "/repo/team-rules/mechanisms/audit/TM-1/piece.json" }]]);
  });
});
