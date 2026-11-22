import { describe, expect, it } from "vitest";

import { runLoadFailureOutcomeOf } from "./run-load-failure-outcome.ts";

describe("runLoadFailureOutcomeOf", () => {
  it("prints the load failure as one line and exits 2, whatever the failure", () => {
    expect(
      runLoadFailureOutcomeOf({
        failure: { kind: "config-absent", repo: "/repo" },
        upgradeCommand: undefined,
      }),
    ).toEqual({
      code: 2,
      text: "load failure: config-absent /repo holds no hone.config.json; give the folder that holds it, usually the repository root\n",
    });
  });

  it("names the upgrade command it is given on the line it prints for a version 1 file", () => {
    expect(
      runLoadFailureOutcomeOf({
        failure: { kind: "upgrade-needed", path: "disciplines.json" },
        upgradeCommand: "node /tool/tool-command.js upgrade --repo /repo",
      }),
    ).toEqual({
      code: 2,
      text: "load failure: upgrade-needed disciplines.json: this is a version 1 file; run node /tool/tool-command.js upgrade --repo /repo, which rewrites every version 1 file as version 2, and commit what it writes\n",
    });
  });
});
