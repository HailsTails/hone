import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { catalogueClausesOf } from "./installed-pieces.ts";

const INSTALL_ROOT = absoluteRootOf("/install");

const CLAUSE = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-27"), clause: clauseIdOf("test-body-logic") };

describe("catalogueClausesOf", () => {
  it("reads the legacy clause's form names from the named walker piece", () => {
    const path = { join: vi.fn<PathPort["join"]>()
      .mockReturnValueOnce("/install/src/infrastructure/engines/walker/rebinding/test-body/piece.json")
      .mockReturnValueOnce("/install/src/infrastructure/engines/walker/branch-in-a-test/test-body/piece.json")
      .mockReturnValueOnce("/install/src/infrastructure/engines/walker/branch-in-a-test/test-body/test-body.examples.json")
      .mockReturnValueOnce("/install/src/infrastructure/engines/walker/branch-in-a-test/test-body") };
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("absent").mockReturnValueOnce("present"),
      read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({
        outcome: "ok",
        value: '{"version":2,"anchor":{"kind":"file"},"settings":{},"forms":{"a-let":{"symptom":"rebinding","check":"test-body"},"branching-with-if":{"symptom":"branch-in-a-test","check":"test-body"}}}',
      }),
      write: vi.fn<FileTextPort["write"]>(),
    };

    expect(catalogueClausesOf({
      installRoot: INSTALL_ROOT, path, fileText,
      names: {
        clauses: [], claimsPieceForms: [CLAUSE], formatsOfToday: {}, clauseOfCheck: new Map(),
        namedClauses: [{ clause: CLAUSE, kind: "mechanical", anchor: { kind: "file" }, checks: [{ name: "test-body", symptom: { name: "rebinding" } }, { name: "test-body", symptom: { name: "branch-in-a-test" } }] }],
      },
    })).toEqual({
      outcome: "ok",
      value: [{
        clause: CLAUSE,
        sight: { kind: "symptom-by-form", forms: [{ section: "a-let", symptom: "rebinding" }, { section: "branching-with-if", symptom: "branch-in-a-test" }] },
      }],
    });
  });
});
