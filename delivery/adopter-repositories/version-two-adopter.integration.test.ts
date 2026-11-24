import { afterAll, describe, expect, it } from "vitest";

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

const CHECK_WITHOUT_A_BASE = [TOOL_COMMAND_FILE, "check", "--repo", "."];

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

const DONE = { outcome: "ok", value: null };

const WRITTEN = { outcome: "ok", value: undefined };

const SUCCEEDED = expect.objectContaining({ outcome: "exited", exitCode: 0 });

const FORFEITURE_UNMEASURED = {
  outcome: "exited",
  exitCode: 1,
  output: expect.stringContaining("forfeiture-unmeasured no-base-revision"),
};

const ANSWERED_BY_DEBT = {
  outcome: "exited",
  exitCode: 0,
  output: expect.stringContaining(
    "claimed-type#cast-to-any walker src/cast.ts:1:22 JSON.parse(text) as any;  answered by debt",
  ),
};

const NEW_FINDING = {
  outcome: "exited",
  exitCode: 1,
  output: expect.stringContaining(
    "claimed-type#cast-to-any walker src/added.ts:1:21 JSON.parse(text) as any;",
  ),
};

const FORFEITED = {
  outcome: "exited",
  exitCode: 1,
  output: expect.stringContaining(
    "claimed-type#cast-to-any debt src/cast.ts; this change touched its file, so it no longer answers",
  ),
};

const HELD_AT_THE_MOVED_PATH = {
  outcome: "exited",
  exitCode: 1,
  output: expect.stringContaining(
    "hone-records/debt/claimed-type.json records[0] held-at-moved-path src/moved.ts: git moved its file there; run record-debt to repoint it",
  ),
};

const REPOINTED = {
  outcome: "exited",
  exitCode: 0,
  output: expect.stringContaining(
    "hone-records/debt/claimed-type.json records[0] repointed to src/moved.ts",
  ),
};

const ANSWERED_BY_DEBT_AT_THE_MOVED_PATH = {
  outcome: "exited",
  exitCode: 0,
  output: expect.stringContaining(
    "claimed-type#cast-to-any walker src/moved.ts:1:22 JSON.parse(text) as any;  answered by debt",
  ),
};

const FORFEITED_AT_THE_MOVED_PATH = {
  outcome: "exited",
  exitCode: 1,
  output: expect.stringContaining(
    "claimed-type#cast-to-any debt src/moved.ts; this change touched its file, so it no longer answers",
  ),
};

afterAll(() => {
  scratch.removeTree({ path: JUDGED_AGAINST_A_BASE });
  scratch.removeTree({ path: MOVED_SINCE_THE_BASE });
});

describe("a version 2 adopter's repository judged against a real git base, run as the real tool command", () => {
  it(
    "cannot judge debt with no base, passes with the base when nothing changed, reports a new violation, and forfeits debt on a file the change touched",
    () => {
      const repo = JUDGED_AGAINST_A_BASE;
      expect([
        scratch.removeTree({ path: repo }),
        scratch.makeDirectory({ path: `${repo}/src` }),
        fileText.write({ path: `${repo}/hone.config.json`, text: CONFIG }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: ESLINT_CONFIG }),
        fileText.write({ path: `${repo}/src/cast.ts`, text: CAST_SOURCE }),
        commands.run({ command: "git", arguments: GIT_INIT, directory: repo }),
        commands.run({ command: "node", arguments: PROJECT, directory: repo }),
        commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
        commands.run({ command: "git", arguments: GIT_COMMIT, directory: repo }),
        commands.run({ command: "node", arguments: RECORD_DEBT, directory: repo }),
        commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
        commands.run({ command: "git", arguments: GIT_COMMIT, directory: repo }),
      ]).toEqual([
        DONE,
        DONE,
        WRITTEN,
        WRITTEN,
        WRITTEN,
        SUCCEEDED,
        SUCCEEDED,
        SUCCEEDED,
        SUCCEEDED,
        SUCCEEDED,
        SUCCEEDED,
        SUCCEEDED,
      ]);
      const withoutBase = commands.run({
        command: "node",
        arguments: CHECK_WITHOUT_A_BASE,
        directory: repo,
      });
      const unchanged = commands.run({ command: "node", arguments: CHECK, directory: repo });
      expect([
        fileText.write({ path: `${repo}/src/added.ts`, text: SECOND_CAST_SOURCE }),
        commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
      ]).toEqual([WRITTEN, SUCCEEDED]);
      const added = commands.run({ command: "node", arguments: CHECK, directory: repo });
      expect(fileText.write({ path: `${repo}/src/cast.ts`, text: TOUCHED_CAST_SOURCE })).toEqual(
        WRITTEN,
      );
      const touched = commands.run({ command: "node", arguments: CHECK, directory: repo });
      expect({ withoutBase, unchanged, added, touched }).toEqual({
        withoutBase: FORFEITURE_UNMEASURED,
        unchanged: ANSWERED_BY_DEBT,
        added: NEW_FINDING,
        touched: FORFEITED,
      });
    },
    EACH_STEP_IS_A_PROCESS_MILLISECONDS,
  );

  it(
    "refuses debt held at a path git moved until record-debt repoints it, keeps it across the pure move, and forfeits it once the moved file is edited",
    () => {
      const repo = MOVED_SINCE_THE_BASE;
      expect([
        scratch.removeTree({ path: repo }),
        scratch.makeDirectory({ path: `${repo}/src` }),
        fileText.write({ path: `${repo}/hone.config.json`, text: CONFIG }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: ESLINT_CONFIG }),
        fileText.write({ path: `${repo}/src/cast.ts`, text: CAST_SOURCE }),
        commands.run({ command: "git", arguments: GIT_INIT, directory: repo }),
        commands.run({ command: "node", arguments: PROJECT, directory: repo }),
        commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
        commands.run({ command: "git", arguments: GIT_COMMIT, directory: repo }),
        commands.run({ command: "node", arguments: RECORD_DEBT, directory: repo }),
        commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
        commands.run({ command: "git", arguments: GIT_COMMIT, directory: repo }),
        commands.run({ command: "git", arguments: GIT_MOVE, directory: repo }),
      ]).toEqual([
        DONE,
        DONE,
        WRITTEN,
        WRITTEN,
        WRITTEN,
        SUCCEEDED,
        SUCCEEDED,
        SUCCEEDED,
        SUCCEEDED,
        SUCCEEDED,
        SUCCEEDED,
        SUCCEEDED,
        SUCCEEDED,
      ]);
      const moved = commands.run({ command: "node", arguments: CHECK, directory: repo });
      const repointed = commands.run({ command: "node", arguments: RECORD_DEBT, directory: repo });
      const kept = commands.run({ command: "node", arguments: CHECK, directory: repo });
      expect(fileText.write({ path: `${repo}/src/moved.ts`, text: TOUCHED_CAST_SOURCE })).toEqual(
        WRITTEN,
      );
      const edited = commands.run({ command: "node", arguments: CHECK, directory: repo });
      expect({ moved, repointed, kept, edited }).toEqual({
        moved: HELD_AT_THE_MOVED_PATH,
        repointed: REPOINTED,
        kept: ANSWERED_BY_DEBT_AT_THE_MOVED_PATH,
        edited: FORFEITED_AT_THE_MOVED_PATH,
      });
    },
    EACH_STEP_IS_A_PROCESS_MILLISECONDS,
  );
});
