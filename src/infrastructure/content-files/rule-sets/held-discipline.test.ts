import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import { createPathPort } from "../../node/path-port.ts";
import { readHeldDiscipline } from "./held-discipline.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const INSTALL_ROOT = absoluteRootOf("/install");

const TEAM_ROOT = absoluteRootOf("/repo/team-rules");

const TM_1 = disciplineIdOf("TM-1");

const TM_1_PATH = "/repo/team-rules/rules/TM-1/discipline.json";

const TM_1_TEXT = '{ "version": 1, "id": "TM-1", "clauses": [{ "kind": "judgement", "id": "naming", "summary": "names say what they hold", "enforcedBy": "review" }] }';

const fileTextOf = (request: { readonly exists: FileTextPort["exists"]; readonly read: FileTextPort["read"] }): FileTextPort => ({
  exists: request.exists,
  read: request.read,
  write: vi.fn<FileTextPort["write"]>(),
});

describe("readHeldDiscipline", () => {
  it("reads a team rule set's discipline from its own discipline file", () => {
    const exists = vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present");
    const read = vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "ok", value: TM_1_TEXT });
    expect(readHeldDiscipline({ fileText: fileTextOf({ exists, read }), path: PATH, ruleSetRoot: TEAM_ROOT, installRoot: INSTALL_ROOT, discipline: TM_1 })).toEqual({
      outcome: "ok",
      value: { held: "present", file: { version: 1, id: "TM-1", clauses: [{ kind: "judgement", id: "naming", enforcedBy: "review" }] } },
    });
    expect(read.mock.calls).toEqual([[{ path: TM_1_PATH }]]);
  });

  it("holds nothing, reading nothing, when a team rule set has no file for the discipline", () => {
    const exists = vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("absent");
    const read = vi.fn<FileTextPort["read"]>();
    expect(readHeldDiscipline({ fileText: fileTextOf({ exists, read }), path: PATH, ruleSetRoot: TEAM_ROOT, installRoot: INSTALL_ROOT, discipline: TM_1 })).toEqual({
      outcome: "ok",
      value: { held: "absent" },
    });
    expect(exists.mock.calls).toEqual([[{ path: TM_1_PATH }]]);
    expect(read).not.toHaveBeenCalled();
  });

  it("carries a team discipline file's refusal", () => {
    const exists = vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present");
    const read = vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "ok", value: "{ version" });
    expect(readHeldDiscipline({ fileText: fileTextOf({ exists, read }), path: PATH, ruleSetRoot: TEAM_ROOT, installRoot: INSTALL_ROOT, discipline: TM_1 })).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: TM_1_PATH },
    });
  });

  it("reads the install's discipline from its names map rather than a discipline file, carrying the map's failure", () => {
    const exists = vi.fn<FileTextPort["exists"]>();
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValueOnce({ outcome: "failed", error: { kind: "unreadable", path: "/install/src/infrastructure/disciplines-file/version-one-names.json", detail: "ENOENT" } });
    expect(
      readHeldDiscipline({ fileText: fileTextOf({ exists, read }), path: PATH, ruleSetRoot: INSTALL_ROOT, installRoot: INSTALL_ROOT, discipline: disciplineIdOf("CD-14") }),
    ).toEqual({ outcome: "failed", error: { kind: "file-unreadable", path: "/install/src/infrastructure/disciplines-file/version-one-names.json", detail: "ENOENT" } });
    expect(exists).not.toHaveBeenCalled();
  });
});
