import { describe, expect, it, vi } from "vitest";

import type { Finding } from "../../../domain/finding/governance.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import type { SelectionReading } from "../../../domain/settings/selection/selection.ts";
import type { EnginePass } from "../../ports/upgrade/engine-pass.ts";
import { versionOneProofReportOf } from "./version-one-proof-report.ts";

const CLAUSE: ClauseAddress = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("loops"),
};

const FILE = repoPathOf("lib/legacy.ts");

const SELECTION: SelectionReading = {
  selection: { selected: [], uncovered: [], notAdopted: [], notRun: [], editions: [] },
  bindings: [],
  clauseRoots: [],
  excluded: [repoPathOf("generated/item.ts")],
  eslintConfigRoots: [],
  fileExceptionWhyChains: "optional",
};

describe("versionOneProofReportOf", () => {
  it("passes the original records to the proof and reports their effect on the unfiltered findings", async () => {
    const finding: Finding = {
      clause: CLAUSE,
      mechanism: "walker",
      file: FILE,
      anchor: { line: 4, column: 0 },
      snippet: "while (pending) {}",
    };
    const debt: ExceptionRecord = {
      kind: "file-carve-out",
      clause: CLAUSE,
      mechanism: "walker",
      file: FILE,
    };
    const findingsFor = vi.fn<EnginePass["findingsFor"]>().mockResolvedValue({
      outcome: "ok",
      value: { findings: [finding], runs: [] },
    });

    const report = await versionOneProofReportOf({
      selection: SELECTION,
      exceptions: { records: [debt], invalid: [] },
      touched: { measured: "yes", paths: new Set() },
      assessment: [],
      unmeasured: [],
      pass: { findingsFor },
    });

    expect(findingsFor).toHaveBeenCalledExactlyOnceWith({ records: [debt] });
    expect(report).toMatchObject({
      outcome: "ok",
      value: { findings: [], exempted: [{ finding }], excluded: ["generated/item.ts"] },
    });
  });

  it("refuses with the version one projection path and its state when measurement cannot run", async () => {
    const findingsFor = vi.fn<EnginePass["findingsFor"]>().mockResolvedValue({
      outcome: "failed",
      error: {
        kind: "projection-not-current",
        file: repoPathOf("packages/web/disciplines.eslint.mjs"),
        state: "not-applied",
      },
    });

    await expect(
      versionOneProofReportOf({
        selection: SELECTION,
        exceptions: { records: [], invalid: [] },
        touched: { measured: "elsewhere" },
        assessment: [],
        unmeasured: [],
        pass: { findingsFor },
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: "disciplines.json",
        detail: "packages/web/disciplines.eslint.mjs is not-applied",
      },
    });
  });
});
