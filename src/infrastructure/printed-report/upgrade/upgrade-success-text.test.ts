import { describe, expect, it } from "vitest";
import { createPathPort } from "../../node/path-port.ts";
import { absolutePathSchema } from "../../content-files/absolute-path.ts";
import { clauseAddressSchema, TOOL_RULE_SET } from "../../discipline-exceptions-folder/clause-address.ts";
import { ruleSetNameSchema } from "../../hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../hone-records-folder/repo-path.ts";
import { upgradeSuccessOutcomeOf } from "./upgrade-success-text.ts";

const REPO = absolutePathSchema.parse("/repo");

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

describe("upgradeSuccessOutcomeOf", () => {
  it("lists what was written, what was rewritten and what was removed, relative to the repository", () => {
    expect(
      upgradeSuccessOutcomeOf({
        repoRoot: REPO,
        path: PATH,
        carried: {
          markedNotAdopted: [],
          written: [repoPathSchema.parse("hone.config.json"), repoPathSchema.parse("hone-records/debt/loop-keyword.json")],
          replaced: [repoPathSchema.parse("eslint.config.mjs"), repoPathSchema.parse("packages/a/eslint.config.mjs")],
          removed: {
            files: [absolutePathSchema.parse("/repo/discipline-exceptions/cd-15.json"), absolutePathSchema.parse("/repo/disciplines.json")],
            folders: [absolutePathSchema.parse("/repo/discipline-exceptions")],
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
          written: [repoPathSchema.parse("hone.config.json")],
          replaced: [],
          removed: { files: [absolutePathSchema.parse("/repo/disciplines.json")], folders: [] },
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
            { check: { ruleSet: TOOL_RULE_SET, check: "claimed-type#claimed-type" }, clause: clauseAddressSchema.parse("CD-2#cast-expressions"), reason: "discipline-not-selected" },
            { check: { ruleSet: { name: ruleSetNameSchema.parse("team") }, check: "claimed-type#claimed-members" }, clause: clauseAddressSchema.parse("team/CD-2#members"), reason: "discipline-not-selected" },
          ],
          written: [repoPathSchema.parse("hone.config.json")],
          replaced: [],
          removed: { files: [absolutePathSchema.parse("/repo/disciplines.json")], folders: [] },
        },
      }),
    ).toEqual({
      code: 0,
      text: "upgraded to version 2\nmarked claimed-type#claimed-type not-adopted: its discipline was not selected in version 1\nmarked team/claimed-type#claimed-members not-adopted: its discipline was not selected in version 1\nwrote hone.config.json\nremoved disciplines.json\n",
    });
  });
});
