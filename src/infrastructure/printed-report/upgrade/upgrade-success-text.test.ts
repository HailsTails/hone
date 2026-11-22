import { describe, expect, it } from "vitest";
import { createPathPort } from "../../node/path-port.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { upgradeSuccessOutcomeOf } from "./upgrade-success-text.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { ruleSetNameOf } from "../../../domain/rule-set/rule-set-name-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";

const REPO = absoluteRootOf("/repo");

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

describe("upgradeSuccessOutcomeOf", () => {
  it("lists what was written, what was rewritten and what was removed, relative to the repository", () => {
    expect(
      upgradeSuccessOutcomeOf({
        repoRoot: REPO,
        path: PATH,
        carried: {
          markedNotAdopted: [],
          written: [repoPathOf("hone.config.json"), repoPathOf("hone-records/debt/loop-keyword.json")],
          replaced: [repoPathOf("eslint.config.mjs"), repoPathOf("packages/a/eslint.config.mjs")],
          removed: {
            files: [absoluteRootOf("/repo/discipline-exceptions/cd-15.json"), absoluteRootOf("/repo/disciplines.json")],
            folders: [absoluteRootOf("/repo/discipline-exceptions")],
          },
        },
      }),
    ).toEqual({
      code: 0,
      text: "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/debt/loop-keyword.json\nrewrote eslint.config.mjs\nrewrote packages/a/eslint.config.mjs\nremoved discipline-exceptions/cd-15.json\nremoved disciplines.json\nremoved discipline-exceptions\n",
    });
  });

  it("names no rewrite when the repository had no team config", () => {
    expect(
      upgradeSuccessOutcomeOf({
        repoRoot: REPO,
        path: PATH,
        carried: {
          markedNotAdopted: [],
          written: [repoPathOf("hone.config.json")],
          replaced: [],
          removed: { files: [absoluteRootOf("/repo/disciplines.json")], folders: [] },
        },
      }),
    ).toEqual({ code: 0, text: "upgraded to version 2\nwrote hone.config.json\nremoved disciplines.json\n" });
  });

  it("names each check it marked not-adopted, with the reason, before the files", () => {
    expect(
      upgradeSuccessOutcomeOf({
        repoRoot: REPO,
        path: PATH,
        carried: {
          markedNotAdopted: [
            { check: { ruleSet: TOOL_RULE_SET, check: "claimed-type#claimed-type" }, clause: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-2"), clause: clauseIdOf("cast-expressions") }, reason: "discipline-not-selected" },
            { check: { ruleSet: { name: ruleSetNameOf("team") }, check: "claimed-type#claimed-members" }, clause: { ruleSet: { name: ruleSetNameOf("team") }, discipline: disciplineIdOf("CD-2"), clause: clauseIdOf("members") }, reason: "discipline-not-selected" },
          ],
          written: [repoPathOf("hone.config.json")],
          replaced: [],
          removed: { files: [absoluteRootOf("/repo/disciplines.json")], folders: [] },
        },
      }),
    ).toEqual({
      code: 0,
      text: "upgraded to version 2\nmarked claimed-type#claimed-type not-adopted: its discipline was not selected in version 1\nmarked team/claimed-type#claimed-members not-adopted: its discipline was not selected in version 1\nwrote hone.config.json\nremoved disciplines.json\n",
    });
  });
});
