import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { createPathPort } from "../../node/path-port.ts";
import { readInstallChecks } from "./install-checks.ts";

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/install" });

const INSTALL_ROOT = absoluteRootOf("/install");

const NAMES_PATH = "/install/src/infrastructure/disciplines-file/version-one-names.json";

const NAMES_TEXT = `{
  "version": 1,
  "clauses": [
    { "clause": "CD-14#class-syntax", "sight": { "kind": "one-symptom", "symptom": "authored-class-or-this" }, "checks": ["authored-class-or-this#static-members-only", "authored-class-or-this#class-keyword"], "anchor": { "kind": "keyword", "keyword": "class" } },
    { "clause": "CD-14#class-intent", "sight": { "kind": "outside-the-cases" }, "checks": [] },
    { "clause": "CD-15#loops", "sight": { "kind": "one-symptom", "symptom": "loop-keyword" }, "checks": ["loop-keyword#loop-statement"], "anchor": { "kind": "file" } }
  ],
  "recordKinds": {}
}`;

const CLASS_SYNTAX = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-14"),
  clause: clauseIdOf("class-syntax"),
};

const CLASS_INTENT = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-14"),
  clause: clauseIdOf("class-intent"),
};

describe("readInstallChecks", () => {
  it("gives the checks the version 1 names map gives the clause, in address order", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present"),
      read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "ok", value: NAMES_TEXT }),
      write: vi.fn<FileTextPort["write"]>(),
    };
    expect(
      readInstallChecks({ fileText, path: PATH, installRoot: INSTALL_ROOT, clause: CLASS_SYNTAX }),
    ).toEqual({
      outcome: "ok",
      value: [
        { name: "class-keyword", symptom: { name: "authored-class-or-this" } },
        { name: "static-members-only", symptom: { name: "authored-class-or-this" } },
      ],
    });
    expect(fileText.read).toHaveBeenCalledExactlyOnceWith({ path: NAMES_PATH });
  });

  it("gives no checks for a clause the map names with none", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present"),
      read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "ok", value: NAMES_TEXT }),
      write: vi.fn<FileTextPort["write"]>(),
    };
    expect(
      readInstallChecks({ fileText, path: PATH, installRoot: INSTALL_ROOT, clause: CLASS_INTENT }),
    ).toEqual({ outcome: "ok", value: [] });
  });

  it("fails as the map fails when it cannot be read", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present"),
      read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({
        outcome: "failed",
        error: { kind: "unreadable", path: NAMES_PATH, detail: "EACCES" },
      }),
      write: vi.fn<FileTextPort["write"]>(),
    };
    expect(
      readInstallChecks({ fileText, path: PATH, installRoot: INSTALL_ROOT, clause: CLASS_SYNTAX }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: NAMES_PATH, detail: "EACCES" },
    });
  });

  it("fails file-malformed at the names path when the names hold a team's clause", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present"),
      read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({
        outcome: "ok",
        value:
          '{ "version": 1, "clauses": [{ "clause": "acme/ACME-1#console-calls", "sight": { "kind": "one-symptom", "symptom": "direct-console" }, "checks": ["direct-console#console-calls"], "anchor": { "kind": "file" } }], "recordKinds": {} }',
      }),
      write: vi.fn<FileTextPort["write"]>(),
    };

    const checks = readInstallChecks({
      fileText,
      path: PATH,
      installRoot: INSTALL_ROOT,
      clause: CLASS_SYNTAX,
    });

    expect(checks).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: NAMES_PATH,
        detail: "✖ acme/ACME-1#console-calls is not a clause of this rule set",
      },
    });
  });
});
