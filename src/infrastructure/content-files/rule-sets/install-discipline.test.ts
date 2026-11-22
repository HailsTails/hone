import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import { createPathPort } from "../../node/path-port.ts";
import { readInstallDiscipline } from "./install-discipline.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/install" });

const INSTALL_ROOT = absoluteRootOf("/install");

const CD_14 = disciplineIdOf("CD-14");

const NAMES_PATH = "/install/src/infrastructure/disciplines-file/version-one-names.json";

const AUDIT_PIECE_PATH = "/install/src/infrastructure/engines/walker/authored-class-or-this/class-keyword/piece.json";

const ESLINT_PIECE_PATH = "/install/src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/piece.json";

const AUDIT_CASES_PATH = "/install/src/infrastructure/engines/walker/authored-class-or-this/class-keyword/class-keyword.examples.json";

const NAMES_TEXT = `{
  "version": 1,
  "clauses": [
    { "clause": "CD-14#class-syntax", "sight": { "kind": "one-symptom", "symptom": "authored-class-or-this" }, "checks": ["authored-class-or-this#class-keyword"], "anchor": { "kind": "keyword", "keyword": "class" } },
    { "clause": "CD-14#class-intent", "sight": { "kind": "outside-the-cases" }, "checks": [] },
    { "clause": "CD-15#loops", "sight": { "kind": "one-symptom", "symptom": "loop-keyword" }, "checks": ["loop-keyword#loop-statement"], "anchor": { "kind": "file" } }
  ],
  "recordKinds": {}
}`;

const NAMES_WITHOUT_CD_14_TEXT = `{
  "version": 1,
  "clauses": [{ "clause": "CD-15#loops", "sight": { "kind": "one-symptom", "symptom": "loop-keyword" }, "checks": ["loop-keyword#loop-statement"], "anchor": { "kind": "file" } }],
  "recordKinds": {}
}`;

const AUDIT_PIECE_TEXT = '{ "version": 2, "anchor": { "kind": "keyword", "keyword": "class" }, "settings": { "module": "class-syntax.ts" } }';

const ESLINT_PIECE_TEXT = '{ "version": 2, "anchor": { "kind": "keyword", "keyword": "class" }, "settings": { "rule": "no-class" } }';

const MALFORMED_PIECE_TEXT = '{ "version": 1, "discipline": "CD-14", "mechanism": "walker" }';

const CASES_TEXT = `{
  "flag": [{ "name": "a class", "fileName": "src/a.ts", "source": "class A {}\\n", "expectedLines": [1] }],
  "allow": [{ "name": "no class", "fileName": "src/b.ts", "source": "const b = 1;\\n", "expectedLines": [] }]
}`;

const MALFORMED_CASES_TEXT = '{ "flag": [], "allow": [] }';

const fileTextOf = (request: { readonly exists: FileTextPort["exists"]; readonly read: FileTextPort["read"] }): FileTextPort => ({
  exists: request.exists,
  read: request.read,
  write: vi.fn<FileTextPort["write"]>(),
});

describe("readInstallDiscipline", () => {
  it("holds nothing, probing no piece, when the names map names no clause of the discipline", () => {
    const exists = vi.fn<FileTextPort["exists"]>();
    const read = vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "ok", value: NAMES_WITHOUT_CD_14_TEXT });
    expect(readInstallDiscipline({ fileText: fileTextOf({ exists, read }), path: PATH, installRoot: INSTALL_ROOT, discipline: CD_14 })).toEqual({
      outcome: "ok",
      value: { held: "absent" },
    });
    expect(exists).not.toHaveBeenCalled();
  });

  it("assembles each mechanical clause from the names map, the pieces that run it and the cases beside one of them, and each judgement clause as reviewed", () => {
    const exists = vi
      .fn<FileTextPort["exists"]>()
      .mockReturnValueOnce("present")
      .mockReturnValueOnce("present")
      .mockReturnValueOnce("present")
      .mockReturnValueOnce("absent");
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValueOnce({ outcome: "ok", value: NAMES_TEXT })
      .mockReturnValueOnce({ outcome: "ok", value: AUDIT_PIECE_TEXT })
      .mockReturnValueOnce({ outcome: "ok", value: ESLINT_PIECE_TEXT })
      .mockReturnValueOnce({ outcome: "ok", value: CASES_TEXT });
    expect(readInstallDiscipline({ fileText: fileTextOf({ exists, read }), path: PATH, installRoot: INSTALL_ROOT, discipline: CD_14 })).toEqual({
      outcome: "ok",
      value: {
        held: "present",
        file: {
          version: 1,
          id: "CD-14",
          clauses: [
            {
              kind: "mechanical",
              id: "class-syntax",
              mechanisms: ["walker", "eslint"],
              anchor: { kind: "keyword", keyword: "class" },
              exceptions: "allowed",
              cases: {
                flag: [{ name: "a class", fileName: "src/a.ts", source: "class A {}\n", expectedLines: [1] }],
                allow: [{ name: "no class", fileName: "src/b.ts", source: "const b = 1;\n", expectedLines: [] }],
              },
            },
            { kind: "judgement", id: "class-intent", enforcedBy: "review" },
          ],
        },
      },
    });
    expect(read.mock.calls).toEqual([[{ path: NAMES_PATH }], [{ path: AUDIT_PIECE_PATH }], [{ path: ESLINT_PIECE_PATH }], [{ path: AUDIT_CASES_PATH }]]);
  });

  it("refuses a mechanical clause no piece runs as rule-set-invalid at the names map", () => {
    const exists = vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("absent").mockReturnValueOnce("absent");
    const read = vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "ok", value: NAMES_TEXT });
    expect(readInstallDiscipline({ fileText: fileTextOf({ exists, read }), path: PATH, installRoot: INSTALL_ROOT, discipline: CD_14 })).toEqual({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: NAMES_PATH, detail: "no piece runs CD-14#class-syntax" },
    });
  });

  it("refuses a mechanical clause whose cases sit beside no piece that runs it", () => {
    const exists = vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present").mockReturnValueOnce("absent").mockReturnValueOnce("absent");
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValueOnce({ outcome: "ok", value: NAMES_TEXT })
      .mockReturnValueOnce({ outcome: "ok", value: AUDIT_PIECE_TEXT });
    expect(readInstallDiscipline({ fileText: fileTextOf({ exists, read }), path: PATH, installRoot: INSTALL_ROOT, discipline: CD_14 })).toEqual({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: NAMES_PATH, detail: "no piece that runs CD-14#class-syntax holds its examples" },
    });
  });

  it("refuses cases that are not a clause's cases as rule-set-invalid at the cases file", () => {
    const exists = vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present").mockReturnValueOnce("absent").mockReturnValueOnce("present");
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValueOnce({ outcome: "ok", value: NAMES_TEXT })
      .mockReturnValueOnce({ outcome: "ok", value: AUDIT_PIECE_TEXT })
      .mockReturnValueOnce({ outcome: "ok", value: MALFORMED_CASES_TEXT });
    expect(readInstallDiscipline({ fileText: fileTextOf({ exists, read }), path: PATH, installRoot: INSTALL_ROOT, discipline: CD_14 })).toEqual({
      outcome: "failed",
      error: {
        kind: "rule-set-invalid",
        path: AUDIT_CASES_PATH,
        detail: "✖ a mechanical clause has no flag case\n  → at flag\n✖ a mechanical clause has no allow case\n  → at allow",
      },
    });
  });

  it("refuses a piece that is not a piece file as file-malformed at the piece", () => {
    const exists = vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present");
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValueOnce({ outcome: "ok", value: NAMES_TEXT })
      .mockReturnValueOnce({ outcome: "ok", value: MALFORMED_PIECE_TEXT });
    expect(readInstallDiscipline({ fileText: fileTextOf({ exists, read }), path: PATH, installRoot: INSTALL_ROOT, discipline: CD_14 })).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: AUDIT_PIECE_PATH, detail: expect.stringContaining("authored-class-or-this#class-keyword") },
    });
  });

  it("carries the names map's refusal", () => {
    const exists = vi.fn<FileTextPort["exists"]>();
    const read = vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "failed", error: { kind: "unreadable", path: NAMES_PATH, detail: "EACCES" } });
    expect(readInstallDiscipline({ fileText: fileTextOf({ exists, read }), path: PATH, installRoot: INSTALL_ROOT, discipline: CD_14 })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: NAMES_PATH, detail: "EACCES" },
    });
  });
});
