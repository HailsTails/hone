import { describe, expect, it } from "vitest";

import type { Check } from "../../../domain/language-layer/symptom-catalogue.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { createPathPort } from "../../node/path-port.ts";
import { upgradeSuccessOutcomeOf } from "./upgrade-success-text.ts";

const REPO = absoluteRootOf("/repo");

const LOOPS_CLAUSE: ClauseAddress = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("loops"),
};

const LOOP_KEYWORD_LOOPS: Check = {
  name: "loops",
  symptom: {
    name: "loop-keyword",
    title: "Loop keyword",
    seen: "`for` or `while`.",
    mayIndicate: [],
    breachUsuallySits: "in the unit",
    recipes: [],
    correctUses: [],
  },
  clause: LOOPS_CLAUSE,
  engines: [{ name: "walker" }],
  forms: [],
};

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

describe("upgradeSuccessOutcomeOf", () => {
  it("lists what was written, what was rewritten and what was removed, relative to the repository", () => {
    expect(
      upgradeSuccessOutcomeOf({
        repoRoot: REPO,
        path: PATH,
        carried: {
          written: [
            repoPathOf("hone.config.json"),
            repoPathOf("hone-records/debt/loop-keyword.json"),
          ],
          replaced: [repoPathOf("eslint.config.mjs"), repoPathOf("packages/a/eslint.config.mjs")],
          removed: {
            files: [
              absoluteRootOf("/repo/discipline-exceptions/cd-15.json"),
              absoluteRootOf("/repo/disciplines.json"),
            ],
            folders: [absoluteRootOf("/repo/discipline-exceptions")],
          },
          records: [
            {
              recordKind: "file-carve-out",
              clause: LOOPS_CLAUSE,
              file: repoPathOf("src/a.ts"),
              newKind: "debt",
              check: LOOP_KEYWORD_LOOPS,
              holding: "stated",
            },
            {
              recordKind: "authorised-location",
              clause: LOOPS_CLAUSE,
              file: repoPathOf("src/b.ts"),
              newKind: "authorised-location",
              check: LOOP_KEYWORD_LOOPS,
              holding: "carried",
            },
          ],
          findings: 3,
          mentions: [
            { file: repoPathOf(".github/workflows/ci.yml"), line: 12 },
            { file: repoPathOf("package.json"), line: 4 },
          ],
          unread: [
            { file: repoPathOf("vendor/lib"), detail: "EISDIR: illegal operation on a directory" },
          ],
        },
      }),
    ).toEqual({
      code: 0,
      text: "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/debt/loop-keyword.json\nrewrote eslint.config.mjs\nrewrote packages/a/eslint.config.mjs\nremoved discipline-exceptions/cd-15.json\nremoved disciplines.json\nremoved discipline-exceptions\nfile-carve-out CD-15#loops src/a.ts -> debt loop-keyword#loops\nauthorised-location CD-15#loops src/b.ts -> authorised-location loop-keyword#loops\ncarried loop-keyword#loops src/b.ts\nmention .github/workflows/ci.yml:12\nmention package.json:4\nmention-unread vendor/lib EISDIR: illegal operation on a directory\nupgrade: same findings (3), same verdict\n",
    });
  });

  it("names no rewrite when the repository had no team config", () => {
    expect(
      upgradeSuccessOutcomeOf({
        repoRoot: REPO,
        path: PATH,
        carried: {
          written: [repoPathOf("hone.config.json")],
          replaced: [],
          removed: { files: [absoluteRootOf("/repo/disciplines.json")], folders: [] },
          records: [],
          findings: 0,
          mentions: [],
          unread: [],
        },
      }),
    ).toEqual({
      code: 0,
      text: "upgraded to version 2\nwrote hone.config.json\nremoved disciplines.json\nupgrade: same findings (0), same verdict\n",
    });
  });
});
