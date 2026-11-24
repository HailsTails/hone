import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { catalogueClausesOf } from "./installed-pieces.ts";

const INSTALL_ROOT = absoluteRootOf("/install");

const CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-27"),
  clause: clauseIdOf("test-body-logic"),
};

const BRANCH_PIECE_JSON =
  "/install/src/infrastructure/engines/walker/branch-in-a-test/test-body/piece.json";

const BRANCH_EXAMPLES_JSON =
  "/install/src/infrastructure/engines/walker/branch-in-a-test/test-body/test-body.examples.json";

const BRANCH_PIECE_FOLDER = "/install/src/infrastructure/engines/walker/branch-in-a-test/test-body";

const REBINDING_PIECE_JSON =
  "/install/src/infrastructure/engines/walker/rebinding/test-body/piece.json";

const UNREGISTERED_CHECK_PIECE =
  '{"version":2,"anchor":{"kind":"file"},"settings":{},"forms":{"branching-with-if":{"symptom":"branch-in-a-test","check":"unknown"}}}';

const TWO_FORM_PIECE =
  '{"version":2,"anchor":{"kind":"file"},"settings":{},"forms":{"a-let":{"symptom":"rebinding","check":"test-body"},"branching-with-if":{"symptom":"branch-in-a-test","check":"test-body"}}}';

describe("catalogueClausesOf", () => {
  it("refuses a form that refers to an unregistered check", () => {
    const path = {
      join: vi
        .fn<PathPort["join"]>()
        .mockReturnValueOnce(BRANCH_PIECE_JSON)
        .mockReturnValueOnce(BRANCH_EXAMPLES_JSON)
        .mockReturnValueOnce(BRANCH_PIECE_FOLDER),
    };
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present"),
      read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({
        outcome: "ok",
        value: UNREGISTERED_CHECK_PIECE,
      }),
      write: vi.fn<FileTextPort["write"]>(),
    };
    expect(
      catalogueClausesOf({
        installRoot: INSTALL_ROOT,
        path,
        fileText,
        names: {
          clauses: [],
          claimsPieceForms: [CLAUSE],
          namedClauses: [
            {
              clause: CLAUSE,
              kind: "mechanical",
              anchor: { kind: "file" },
              checks: [{ name: "test-body", symptom: { name: "branch-in-a-test" } }],
            },
          ],
        },
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: BRANCH_PIECE_JSON,
        detail: "form branching-with-if names unregistered check branch-in-a-test#unknown",
      },
    });
  });

  it("reads the legacy clause's form names from the named walker piece", () => {
    const path = {
      join: vi
        .fn<PathPort["join"]>()
        .mockReturnValueOnce(REBINDING_PIECE_JSON)
        .mockReturnValueOnce(BRANCH_PIECE_JSON)
        .mockReturnValueOnce(BRANCH_EXAMPLES_JSON)
        .mockReturnValueOnce(BRANCH_PIECE_FOLDER),
    };
    const fileText: FileTextPort = {
      exists: vi
        .fn<FileTextPort["exists"]>()
        .mockReturnValueOnce("absent")
        .mockReturnValueOnce("present"),
      read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({
        outcome: "ok",
        value: TWO_FORM_PIECE,
      }),
      write: vi.fn<FileTextPort["write"]>(),
    };

    expect(
      catalogueClausesOf({
        installRoot: INSTALL_ROOT,
        path,
        fileText,
        names: {
          clauses: [],
          claimsPieceForms: [CLAUSE],
          namedClauses: [
            {
              clause: CLAUSE,
              kind: "mechanical",
              anchor: { kind: "file" },
              checks: [
                { name: "test-body", symptom: { name: "rebinding" } },
                { name: "test-body", symptom: { name: "branch-in-a-test" } },
              ],
            },
          ],
        },
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          clause: CLAUSE,
          sight: {
            kind: "symptom-by-form",
            forms: [
              { form: "a-let", symptom: "rebinding" },
              { form: "branching-with-if", symptom: "branch-in-a-test" },
            ],
          },
        },
      ],
    });
  });
});
