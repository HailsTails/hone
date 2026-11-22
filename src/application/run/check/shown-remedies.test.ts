import { describe, expect, it, vi } from "vitest";
import type { Finding } from "../../../domain/finding/governance.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { ShownPathOf } from "../../ports/installation/shown-path-of.ts";
import { shownRemediesOf } from "./shown-remedies.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { catalogueNameOf } from "../../../domain/language-layer/catalogue-name.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";

const pathJoining = (join: PathPort["join"]): PathPort => ({
  join,
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  relative: vi.fn<PathPort["relative"]>(),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
});

const shownAs = (shown: string): ShownPathOf => vi.fn<ShownPathOf>().mockReturnValue(shown);

const STORE_ROOT = absoluteRootOf("C:\\work\\my repo\\node_modules\\.pnpm\\@hailstails+hone@1.0.0\\node_modules\\@hailstails\\hone");

const LOCAL_ROOT = absoluteRootOf("C:\\work\\my repo\\team-rules");

const CLAUSE = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-27"), clause: clauseIdOf("test-body-logic") };

const LOCATED: Finding = {
  clause: CLAUSE,
  mechanism: "audit",
  file: repoPathOf("src/a.test.ts"),
  anchor: { line: 3, column: 5 },
  snippet: "rows.map(idOf);",
};

const REMEDIED: Finding = { ...LOCATED, remedy: { fix: "write the values out", page: "CHECKS.md", section: "a-method-that-computes-a-value" } };

const SHIPPED_ROOT = { clause: CLAUSE, ruleSetRoot: STORE_ROOT };

describe("shownRemediesOf", () => {
  it("finds the remedy for a named check in its symptom folder", () => {
    const clause = { ruleSet: TOOL_RULE_SET, symptom: catalogueNameOf("branch-in-a-test"), check: catalogueNameOf("test-body") };
    const symptomFolder = `${STORE_ROOT}/rules/typescript/symptoms/branch-in-a-test`;
    const join = vi.fn<PathPort["join"]>().mockReturnValueOnce(symptomFolder).mockReturnValueOnce(`${symptomFolder}/test-body.md`);
    const shown = "node_modules/@hailstails/hone/rules/typescript/symptoms/branch-in-a-test/test-body.md";
    const remedy = { fix: "write the values out", page: "test-body.md", section: "a-method-that-computes-a-value" };
    expect(shownRemediesOf({
      path: pathJoining(join), shownPathOf: shownAs(shown), clauseRoots: [{ clause, ruleSetRoot: STORE_ROOT }], findings: [{ ...LOCATED, clause, remedy }],
    })).toEqual([{ ...LOCATED, clause, remedy: { ...remedy, page: shown } }]);
    expect(join).toHaveBeenNthCalledWith(1, { segments: [STORE_ROOT, "rules", "typescript", "symptoms", "branch-in-a-test"] });
  });

  it("shows the page a finding's rule names as the path a reader opens, through the repository's link", () => {
    expect(
      shownRemediesOf({
        path: pathJoining(
          vi
            .fn<PathPort["join"]>()
            .mockReturnValueOnce("C:\\work\\my repo\\node_modules\\.pnpm\\@hailstails+hone@1.0.0\\node_modules\\@hailstails\\hone\\rules\\CD-27")
            .mockReturnValueOnce("C:\\work\\my repo\\node_modules\\.pnpm\\@hailstails+hone@1.0.0\\node_modules\\@hailstails\\hone\\rules\\CD-27\\CHECKS.md"),
        ),
        shownPathOf: shownAs("node_modules/@hailstails/hone/rules/CD-27/CHECKS.md"),
        clauseRoots: [SHIPPED_ROOT],
        findings: [REMEDIED],
      }),
    ).toEqual([
      {
        ...LOCATED,
        remedy: {
          fix: "write the values out",
          page: "node_modules/@hailstails/hone/rules/CD-27/CHECKS.md",
          section: "a-method-that-computes-a-value",
        },
      },
    ]);
  });

  it("shows a page in a folder of a local rule set relative to the repository", () => {
    const localRoot = { clause: CLAUSE, ruleSetRoot: LOCAL_ROOT };
    const paged: Finding = { ...LOCATED, remedy: { fix: "write the values out", page: "pages/forms.md", section: "a-form" } };

    expect(
      shownRemediesOf({
        path: pathJoining(
          vi
            .fn<PathPort["join"]>()
            .mockReturnValueOnce("C:\\work\\my repo\\team-rules\\rules\\CD-27")
            .mockReturnValueOnce("C:\\work\\my repo\\team-rules\\rules\\CD-27\\pages/forms.md"),
        ),
        shownPathOf: shownAs("team-rules/rules/CD-27/pages/forms.md"),
        clauseRoots: [localRoot],
        findings: [paged],
      }),
    ).toEqual([{ ...LOCATED, remedy: { fix: "write the values out", page: "team-rules/rules/CD-27/pages/forms.md", section: "a-form" } }]);
  });

  it("keeps a finding with no fix as it is", () => {
    expect(
      shownRemediesOf({ path: pathJoining(vi.fn<PathPort["join"]>()), shownPathOf: vi.fn<ShownPathOf>(), clauseRoots: [SHIPPED_ROOT], findings: [LOCATED] }),
    ).toEqual([LOCATED]);
  });

  it("drops the fix of a finding whose clause has no rule set to find its page in", () => {
    expect(shownRemediesOf({ path: pathJoining(vi.fn<PathPort["join"]>()), shownPathOf: vi.fn<ShownPathOf>(), clauseRoots: [], findings: [REMEDIED] })).toEqual([
      LOCATED,
    ]);
  });
});
