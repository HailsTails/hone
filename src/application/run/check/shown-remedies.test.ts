import { describe, expect, it, vi } from "vitest";
import type { Finding } from "../../../domain/finding/governance.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import { absolutePathSchema } from "../../../infrastructure/content-files/absolute-path.ts";
import { clauseAddressSchema } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { ShownPathOf } from "../../ports/installation/shown-path-of.ts";
import { shownRemediesOf } from "./shown-remedies.ts";

const WINDOWS: PathPort = {
  join: ({ segments }) => segments.join("\\"),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  relative: vi.fn<PathPort["relative"]>(),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};

const STORE_ROOT = absolutePathSchema.parse("C:\\work\\my repo\\node_modules\\.pnpm\\@hailstails+hone@1.0.0\\node_modules\\@hailstails\\hone");

const LOCAL_ROOT = absolutePathSchema.parse("C:\\work\\my repo\\team-rules");

const SHOWN_PATHS = new Map<string, string>([
  [`${STORE_ROOT}\\rules\\CD-27\\CHECKS.md`, "node_modules/@hailstails/hone/rules/CD-27/CHECKS.md"],
  [`${LOCAL_ROOT}\\rules\\CD-27\\pages/forms.md`, "team-rules/rules/CD-27/pages/forms.md"],
]);

const SHOWN_PATH_OF: ShownPathOf = ({ target }) => SHOWN_PATHS.get(target) ?? target;

const CLAUSE = clauseAddressSchema.parse("CD-27#test-body-logic");

const LOCATED: Finding = {
  clause: CLAUSE,
  mechanism: mechanismIdSchema.parse("audit"),
  file: repoPathSchema.parse("src/a.test.ts"),
  anchor: { line: 3, column: 5 },
  snippet: "rows.map(idOf);",
};

const REMEDIED: Finding = { ...LOCATED, remedy: { fix: "write the values out", page: "CHECKS.md", section: "a-method-that-computes-a-value" } };

const SHIPPED_ROOT = { clause: CLAUSE, ruleSetRoot: STORE_ROOT };

describe("shownRemediesOf", () => {
  it("shows the page a finding's rule names as the path a reader opens, through the repository's link", () => {
    expect(
      shownRemediesOf({ path: WINDOWS, shownPathOf: SHOWN_PATH_OF, clauseRoots: [SHIPPED_ROOT], findings: [REMEDIED] }),
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
      shownRemediesOf({ path: WINDOWS, shownPathOf: SHOWN_PATH_OF, clauseRoots: [localRoot], findings: [paged] }),
    ).toEqual([{ ...LOCATED, remedy: { fix: "write the values out", page: "team-rules/rules/CD-27/pages/forms.md", section: "a-form" } }]);
  });

  it("keeps a finding with no fix as it is", () => {
    expect(
      shownRemediesOf({ path: WINDOWS, shownPathOf: SHOWN_PATH_OF, clauseRoots: [SHIPPED_ROOT], findings: [LOCATED] }),
    ).toEqual([LOCATED]);
  });

  it("drops the fix of a finding whose clause has no rule set to find its page in", () => {
    expect(shownRemediesOf({ path: WINDOWS, shownPathOf: SHOWN_PATH_OF, clauseRoots: [], findings: [REMEDIED] })).toEqual([
      LOCATED,
    ]);
  });
});
