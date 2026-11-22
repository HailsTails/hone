import { describe, expect, it } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { createPathPort } from "../../node/path-port.ts";
import { upgradeSuccessOutcomeOf } from "./upgrade-success-text.ts";

const REPO = absoluteRootOf("/repo");

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
          written: [repoPathOf("hone.config.json")],
          replaced: [],
          removed: { files: [absoluteRootOf("/repo/disciplines.json")], folders: [] },
        },
      }),
    ).toEqual({
      code: 0,
      text: "upgraded to version 2\nwrote hone.config.json\nremoved disciplines.json\n",
    });
  });
});
