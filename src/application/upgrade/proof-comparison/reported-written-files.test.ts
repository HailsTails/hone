import { describe, expect, it } from "vitest";

import type { Finding } from "../../../domain/finding/governance.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { reportedWrittenFilesOf } from "./reported-written-files.ts";

const LOOPS_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("loops"),
};

const DECLARATION = repoPathOf("hone.eslint.d.mts");

const PROJECTION = repoPathOf("hone.eslint.mjs");

const SETTINGS = repoPathOf("hone.config.json");

const SOURCE = repoPathOf("src/a.ts");

const findingIn = (request: { readonly file: typeof SOURCE }): Finding => ({
  clause: LOOPS_CLAUSE,
  file: request.file,
  anchor: { line: 1, column: 1 },
  snippet: "for (;;) {}",
  mechanism: "eslint",
});

describe("reportedWrittenFilesOf", () => {
  it("names each written file the run reports in its findings, answered findings or unrecorded exceptions, in the order written", () => {
    expect(
      reportedWrittenFilesOf({
        written: [SETTINGS, PROJECTION, DECLARATION],
        after: {
          findings: [findingIn({ file: SOURCE })],
          answered: [{ finding: findingIn({ file: PROJECTION }), by: [] }],
          unrecorded: [
            { kind: "ignore", clause: LOOPS_CLAUSE, file: DECLARATION, mechanism: "eslint" },
          ],
        },
      }),
    ).toEqual([PROJECTION, DECLARATION]);
  });

  it("places a command-line option at the file whose script holds it", () => {
    expect(
      reportedWrittenFilesOf({
        written: [SETTINGS, PROJECTION],
        after: {
          findings: [],
          answered: [],
          unrecorded: [
            {
              kind: "command-line-option",
              clause: LOOPS_CLAUSE,
              location: SETTINGS,
              script: "lint",
              option: "--no-config-lookup",
              cause: { kind: "weakens-run" },
              mechanism: "eslint",
            },
          ],
        },
      }),
    ).toEqual([SETTINGS]);
  });

  it("names nothing when the run reports only files the upgrade did not write", () => {
    expect(
      reportedWrittenFilesOf({
        written: [SETTINGS, DECLARATION],
        after: { findings: [findingIn({ file: SOURCE })], answered: [], unrecorded: [] },
      }),
    ).toEqual([]);
  });
});
