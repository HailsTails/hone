import { assert, describe, expect, it } from "vitest";
import { createDefaultFileTextPort } from "../../node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../node/path-port.ts";
import type { DisciplineFile } from "../../../domain/rule-set/rule-set-types.ts";
import { clauseIdSchema, disciplineIdSchema } from "../../hone-config-file/identifiers.ts";
import type { MechanismId } from "../../../domain/rule-set/identifier-types.ts";
import { createRuleSetFiles } from "./rule-set-files.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { ruleSetNameOf } from "../../../domain/rule-set/rule-set-name-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";

const PATH = createDefaultPathPort({});

const RULE_SET_FILES = createRuleSetFiles({ fileText: createDefaultFileTextPort({}), path: PATH });

const AUDIT = "audit";

const ESLINT = "eslint" as const;

const rootOf = (name: string) => {
  const resolved = PATH.resolve({ path: PATH.join({ segments: [import.meta.dirname, "team-rule-set", name] }) });
  assert(resolved.outcome === "ok", `${name} resolves to an absolute path`);
  return resolved.value;
};

const TEAM_ROOT = rootOf("repo/team-rules");

const INSTALL_ROOT = rootOf("install");

const mechanicalDiscipline = (request: { readonly id: string; readonly clause: string; readonly mechanism: MechanismId }): DisciplineFile => ({
  version: 1,
  id: disciplineIdSchema.parse(request.id),
  clauses: [
    {
      kind: "mechanical",
      id: clauseIdSchema.parse(request.clause),
      mechanisms: [request.mechanism],
      anchor: { kind: "keyword", keyword: "class" },
      exceptions: "allowed",
      cases: { flag: [], allow: [] },
    },
  ],
});

const TM_1 = mechanicalDiscipline({ id: "TM-1", clause: "no-tmp-files", mechanism: AUDIT });

describe("createRuleSetFiles discipline", () => {
  it("reads a discipline file present on disk", () => {
    expect(RULE_SET_FILES.discipline({ ruleSetRoot: TEAM_ROOT, installRoot: INSTALL_ROOT, discipline: disciplineIdOf("TM-1") })).toMatchObject({
      outcome: "ok",
      value: { held: "present", file: { id: "TM-1", clauses: [{ id: "no-tmp-files", kind: "mechanical" }] } },
    });
  });

  it("holds nothing for a discipline file absent from disk", () => {
    expect(RULE_SET_FILES.discipline({ ruleSetRoot: TEAM_ROOT, installRoot: INSTALL_ROOT, discipline: disciplineIdOf("CD-99") })).toEqual({
      outcome: "ok",
      value: { held: "absent" },
    });
  });
});

describe("createRuleSetFiles piece", () => {
  it("reads a piece file present on disk", () => {
    expect(RULE_SET_FILES.piece({ ruleSetRoot: TEAM_ROOT, installRoot: INSTALL_ROOT, discipline: TM_1, mechanism: AUDIT })).toMatchObject({
      outcome: "ok",
      value: { held: "present", file: { discipline: "TM-1", mechanism: "audit", clauses: [{ clause: "no-tmp-files" }] } },
    });
  });

  it("holds nothing for a piece file absent from disk", () => {
    expect(RULE_SET_FILES.piece({ ruleSetRoot: TEAM_ROOT, installRoot: INSTALL_ROOT, discipline: TM_1, mechanism: ESLINT })).toEqual({
      outcome: "ok",
      value: { held: "absent" },
    });
  });
});

describe("createRuleSetFiles checks", () => {
  it("gives a clause of a named rule set no checks", () => {
    expect(
      RULE_SET_FILES.checks({
        installRoot: INSTALL_ROOT,
        clause: { ruleSet: { name: ruleSetNameOf("team") }, discipline: disciplineIdOf("TM-1"), clause: clauseIdOf("no-tmp-files") },
      }),
    ).toEqual({ outcome: "ok", value: [] });
  });

  it("reads a clause of the tool's own rule set its checks from the install's names map, failing where the install holds no map", () => {
    expect(
      RULE_SET_FILES.checks({
        installRoot: INSTALL_ROOT,
        clause: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-14"), clause: clauseIdOf("class-syntax") },
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: PATH.join({ segments: [INSTALL_ROOT, "src", "infrastructure", "disciplines-file", "version-one-names.json"] }), detail: expect.any(String) },
    });
  });
});

describe("createRuleSetFiles runner", () => {
  it("is present for a runner module on disk", () => {
    expect(RULE_SET_FILES.runner({ installRoot: INSTALL_ROOT, mechanism: AUDIT, moduleExtension: ".js" })).toBe("present");
  });

  it("is absent for a mechanism whose runner is not on disk", () => {
    expect(RULE_SET_FILES.runner({ installRoot: INSTALL_ROOT, mechanism: ESLINT, moduleExtension: ".js" })).toBe("absent");
  });

  it("is absent for a runner module written with the other extension", () => {
    expect(RULE_SET_FILES.runner({ installRoot: INSTALL_ROOT, mechanism: AUDIT, moduleExtension: ".ts" })).toBe("absent");
  });
});
