import { afterAll, assert, describe, expect, it } from "vitest";

import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import {
  createDefaultCommandRunPort,
  createDefaultScratchFilesPort,
} from "../install-proof/install-proof-ports.ts";

const fileText = createDefaultFileTextPort({});

const path = createDefaultPathPort({});

const scratch = createDefaultScratchFilesPort({});

const commands = createDefaultCommandRunPort({});

const INSTALL_ROOT = absolutePathSchema.parse(
  path.join({ segments: [import.meta.dirname, "..", ".."] }),
);

const TOOL_COMMAND_FILE = `${INSTALL_ROOT}/src/hone.ts`;

const JUDGED_AGAINST_A_BASE = `${INSTALL_ROOT}/artefacts/version-two-adopter-judged-against-a-base`;

const MOVED_SINCE_THE_BASE = `${INSTALL_ROOT}/artefacts/version-two-adopter-moved-since-the-base`;

const EACH_STEP_IS_A_PROCESS_MILLISECONDS = 120_000;

const CONFIG = `{
  "version": 2,
  "ruleSets": {},
  "checks": {
    "authored-class-or-this#class-keyword": "eslint",
    "authored-class-or-this#static-members-only": "not-adopted",
    "claimed-type#cast-to-any": "walker",
    "claimed-type#unlisted-cast-site": "not-adopted",
    "claimed-type#non-null-assertions": "not-adopted"
  },
  "exclude": []
}
`;

const ESLINT_CONFIG = `import hone from "./hone.eslint.mjs";
export default [...hone];
`;

const CAST_SOURCE = "export const parsed = JSON.parse(text) as any;\n";

const SECOND_CAST_SOURCE = "export const added = JSON.parse(text) as any;\n";

const TOUCHED_CAST_SOURCE = "export const parsed = JSON.parse(raw) as any;\n";

const PROJECT = [TOOL_COMMAND_FILE, "project", "--repo", "."];

const RECORD_DEBT = [TOOL_COMMAND_FILE, "record-debt", "--repo", ".", "--base-revision", "HEAD"];

const CHECK_NO_BASE = [TOOL_COMMAND_FILE, "check", "--repo", "."];

const CHECK = [TOOL_COMMAND_FILE, "check", "--repo", ".", "--base-revision", "HEAD"];

const GIT_INIT = ["init", "-q"];

const GIT_ADD = ["add", "-A"];

const GIT_COMMIT = [
  "-c",
  "user.name=adopter",
  "-c",
  "user.email=adopter@example.test",
  "-c",
  "commit.gpgsign=false",
  "commit",
  "-q",
  "-m",
  "commit",
];

const GIT_MOVE = ["mv", "src/cast.ts", "src/moved.ts"];

const PRUNE_DEBT = [TOOL_COMMAND_FILE, "prune-debt", "--repo", ".", "--base-revision", "HEAD"];

const DONE = { outcome: "ok", value: null };

const WRITTEN = { outcome: "ok", value: undefined };

const GIT_DONE = { outcome: "exited", exitCode: 0, output: "" };

const DEBT_ON_CAST = `{
  "version": 2,
  "records": [
    {
      "answers": "claimed-type#cast-to-any",
      "file": "src/cast.ts"
    }
  ]
}
`;

const DEBT_ON_MOVED = `{
  "version": 2,
  "records": [
    {
      "answers": "claimed-type#cast-to-any",
      "file": "src/moved.ts"
    }
  ]
}
`;

afterAll(() => {
  scratch.removeTree({ path: JUDGED_AGAINST_A_BASE });
  scratch.removeTree({ path: MOVED_SINCE_THE_BASE });
});

describe("a version 2 adopter's repository judged against a real git base, run as the real tool command", () => {
  it(
    "cannot judge debt with no base, passes when nothing changed, fails on a new violation, and forfeits debt on a file the change touched",
    () => {
      const repo = JUDGED_AGAINST_A_BASE;
      const debtFile = `${repo}/hone-records/debt/claimed-type.json`;
      expect([
        scratch.removeTree({ path: repo }),
        scratch.makeDirectory({ path: `${repo}/src` }),
        fileText.write({ path: `${repo}/hone.config.json`, text: CONFIG }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: ESLINT_CONFIG }),
        fileText.write({ path: `${repo}/src/cast.ts`, text: CAST_SOURCE }),
        commands.run({ command: "git", arguments: GIT_INIT, directory: repo }),
      ]).toEqual([DONE, DONE, WRITTEN, WRITTEN, WRITTEN, GIT_DONE]);
      const projected = commands.run({ command: "node", arguments: PROJECT, directory: repo });
      expect([
        commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
        commands.run({ command: "git", arguments: GIT_COMMIT, directory: repo }),
      ]).toEqual([GIT_DONE, GIT_DONE]);
      const recorded = commands.run({ command: "node", arguments: RECORD_DEBT, directory: repo });
      const debtRecorded = fileText.read({ path: debtFile });
      expect([
        commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
        commands.run({ command: "git", arguments: GIT_COMMIT, directory: repo }),
      ]).toEqual([GIT_DONE, GIT_DONE]);
      const noBase = commands.run({ command: "node", arguments: CHECK_NO_BASE, directory: repo });
      const unchanged = commands.run({ command: "node", arguments: CHECK, directory: repo });
      expect([
        fileText.write({ path: `${repo}/src/added.ts`, text: SECOND_CAST_SOURCE }),
        commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
      ]).toEqual([WRITTEN, GIT_DONE]);
      const added = commands.run({ command: "node", arguments: CHECK, directory: repo });
      expect(fileText.write({ path: `${repo}/src/cast.ts`, text: TOUCHED_CAST_SOURCE })).toEqual(
        WRITTEN,
      );
      const touched = commands.run({ command: "node", arguments: CHECK, directory: repo });
      const pruned = commands.run({ command: "node", arguments: PRUNE_DEBT, directory: repo });
      assert(projected.outcome === "exited", "projected ran");
      assert(recorded.outcome === "exited", "recorded ran");
      assert(noBase.outcome === "exited", "noBase ran");
      assert(unchanged.outcome === "exited", "unchanged ran");
      assert(added.outcome === "exited", "added ran");
      assert(touched.outcome === "exited", "touched ran");
      assert(pruned.outcome === "exited", "pruned ran");
      expect({
        exits: [projected.exitCode, recorded.exitCode, noBase.exitCode, unchanged.exitCode],
        judged: [added.exitCode, touched.exitCode, pruned.exitCode],
        debtRecorded,
        debtAfterPruning: fileText.exists({ path: debtFile }),
      }).toEqual({
        exits: [0, 0, 1, 0],
        judged: [1, 1, 0],
        debtRecorded: { outcome: "ok", value: DEBT_ON_CAST },
        debtAfterPruning: "absent",
      });
    },
    EACH_STEP_IS_A_PROCESS_MILLISECONDS,
  );

  it(
    "refuses debt held at a path git moved until record-debt repoints it, keeps it across the pure move, and forfeits it once the moved file is edited",
    () => {
      const repo = MOVED_SINCE_THE_BASE;
      const debtFile = `${repo}/hone-records/debt/claimed-type.json`;
      expect([
        scratch.removeTree({ path: repo }),
        scratch.makeDirectory({ path: `${repo}/src` }),
        fileText.write({ path: `${repo}/hone.config.json`, text: CONFIG }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: ESLINT_CONFIG }),
        fileText.write({ path: `${repo}/src/cast.ts`, text: CAST_SOURCE }),
        commands.run({ command: "git", arguments: GIT_INIT, directory: repo }),
      ]).toEqual([DONE, DONE, WRITTEN, WRITTEN, WRITTEN, GIT_DONE]);
      const projected = commands.run({ command: "node", arguments: PROJECT, directory: repo });
      expect([
        commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
        commands.run({ command: "git", arguments: GIT_COMMIT, directory: repo }),
      ]).toEqual([GIT_DONE, GIT_DONE]);
      const recorded = commands.run({ command: "node", arguments: RECORD_DEBT, directory: repo });
      expect([
        commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
        commands.run({ command: "git", arguments: GIT_COMMIT, directory: repo }),
        commands.run({ command: "git", arguments: GIT_MOVE, directory: repo }),
      ]).toEqual([GIT_DONE, GIT_DONE, GIT_DONE]);
      const moved = commands.run({ command: "node", arguments: CHECK, directory: repo });
      const debtMoved = fileText.read({ path: debtFile });
      const repointed = commands.run({ command: "node", arguments: RECORD_DEBT, directory: repo });
      const debtRepointed = fileText.read({ path: debtFile });
      const kept = commands.run({ command: "node", arguments: CHECK, directory: repo });
      expect(fileText.write({ path: `${repo}/src/moved.ts`, text: TOUCHED_CAST_SOURCE })).toEqual(
        WRITTEN,
      );
      const edited = commands.run({ command: "node", arguments: CHECK, directory: repo });
      const pruned = commands.run({ command: "node", arguments: PRUNE_DEBT, directory: repo });
      assert(projected.outcome === "exited", "projected ran");
      assert(recorded.outcome === "exited", "recorded ran");
      assert(moved.outcome === "exited", "moved ran");
      assert(repointed.outcome === "exited", "repointed ran");
      assert(kept.outcome === "exited", "kept ran");
      assert(edited.outcome === "exited", "edited ran");
      assert(pruned.outcome === "exited", "pruned ran");
      expect({
        exits: [projected.exitCode, recorded.exitCode, moved.exitCode, repointed.exitCode],
        judged: [kept.exitCode, edited.exitCode, pruned.exitCode],
        debtMoved,
        debtRepointed,
        debtAfterPruning: fileText.exists({ path: debtFile }),
      }).toEqual({
        exits: [0, 0, 1, 0],
        judged: [0, 1, 0],
        debtMoved: { outcome: "ok", value: DEBT_ON_CAST },
        debtRepointed: { outcome: "ok", value: DEBT_ON_MOVED },
        debtAfterPruning: "absent",
      });
    },
    EACH_STEP_IS_A_PROCESS_MILLISECONDS,
  );
});
