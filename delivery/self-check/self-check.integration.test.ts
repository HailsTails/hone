import { afterAll, describe, expect, it } from "vitest";

import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import {
  createDefaultCommandRunPort,
  createDefaultScratchFilesPort,
} from "../install-proof/install-proof-ports.ts";

const REPO = createDefaultPathPort({}).join({
  segments: [import.meta.dirname, "..", "..", "artefacts", "self-check-scratch"],
});

const SELF_CHECK_FILE = createDefaultPathPort({}).join({
  segments: [import.meta.dirname, "self-check.ts"],
});

const EACH_STEP_IS_A_PROCESS_MILLISECONDS = 120_000;

const fileText = createDefaultFileTextPort({});

const scratch = createDefaultScratchFilesPort({});

const commands = createDefaultCommandRunPort({});

afterAll(() => {
  scratch.removeTree({ path: REPO });
});

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

const CLASS_SOURCE = "export class Kept {}\n";

const CAST_SOURCE = "export const parsed = JSON.parse(text) as any;\n";

const GIT_INIT = [
  "-c",
  "user.name=adopter",
  "-c",
  "user.email=adopter@example.test",
  "-c",
  "commit.gpgsign=false",
  "init",
  "-q",
];

const GIT_ADD = [
  "-c",
  "user.name=adopter",
  "-c",
  "user.email=adopter@example.test",
  "-c",
  "commit.gpgsign=false",
  "add",
  ".",
];

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
  "step",
];

const PROJECT = [SELF_CHECK_FILE, "project", "--repo", REPO];

const RECORD_DEBT = [SELF_CHECK_FILE, "record-debt", "--repo", REPO, "--base-revision", "HEAD"];

const CHECK = [SELF_CHECK_FILE, "check", "--repo", REPO];

const CHECK_ELSEWHERE = [SELF_CHECK_FILE, "check", "--repo", REPO, "--forfeiture", "elsewhere"];

const CHECK_AGAINST_HEAD = [SELF_CHECK_FILE, "check", "--repo", REPO, "--base-revision", "HEAD"];

const NOT_ADOPTED =
  "not-adopted (3)\nauthored-class-or-this#static-members-only\nclaimed-type#unlisted-cast-site\nclaimed-type#non-null-assertions\n";

const CLASS_SYMPTOM =
  "authored-class-or-this: Authored class or this. May indicate: keeps state or settings across calls → No hidden effects; reuses behaviour from another unit or type → One reason per module; gives a value its type (declares it, or needs it narrower) → Declared, not asserted. The breach usually sits in the unit. Recipe: Closure factory. Read ../../rules/typescript/symptoms.md#authored-class-or-this\n";

const CAST_SYMPTOM =
  "claimed-type: Claimed type. May indicate: gives a value its type (declares it, or needs it narrower) → Declared, not asserted; checks a value that may be one of several outcomes → Straight-through tests; gives a value its type (declares it, or needs it narrower): in a test, a cast to build an input → Handed what it uses. The breach usually sits in the declaration: an input too wide, a generic not bounded, a missing parse. Recipes: Fix the declaration, not the value; Assert to narrow; One argument object. Read ../../rules/typescript/symptoms.md#claimed-type\n";

const ELSEWHERE_TEXT = `${NOT_ADOPTED}findings (2)
authored-class-or-this#class-keyword eslint src/kept.ts:1:7 export class Kept {} symptom: authored-class-or-this (../../rules/typescript/symptoms.md#authored-class-or-this) may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted
claimed-type#cast-to-any walker src/cast.ts:1:22 JSON.parse(text) as any;  symptom: claimed-type (../../rules/typescript/symptoms.md#claimed-type) may indicate: declared-not-asserted, straight-through-tests, handed-what-it-uses
assessment (1)
forfeiture elsewhere: 0 debt records not checked for forfeiture in this run
symptoms (2)
${CLASS_SYMPTOM}${CAST_SYMPTOM}self-check: fail (partial assessment), failing sections hold entries: findings (2)
`;

const ANSWERED_BY_DEBT = `answered (2)
authored-class-or-this#class-keyword eslint src/kept.ts:1:7 export class Kept {} answered by debt
claimed-type#cast-to-any walker src/cast.ts:1:22 JSON.parse(text) as any;  answered by debt
`;

const UNMEASURED_TEXT = `${NOT_ADOPTED}${ANSWERED_BY_DEBT}unmeasured (1)
forfeiture-unmeasured no-base-revision: no --base-revision was given, so debt cannot be checked for forfeiture; pass --base-revision with the branch's base, such as origin/main, or leave forfeiture to another run with "forfeiture": "elsewhere" in hone.config.json or --forfeiture elsewhere
self-check: fail, failing sections hold entries: unmeasured (1)
`;

const MEASURED_TEXT = `${NOT_ADOPTED}${ANSWERED_BY_DEBT}self-check: pass, no failing section holds an entry
`;

const SUCCEEDED = expect.objectContaining({ outcome: "exited", exitCode: 0 });

const DONE = { outcome: "ok", value: null };

const WRITTEN = { outcome: "ok", value: undefined };

describe("self-check over a version 2 repository, run as the real script", () => {
  it(
    "gates findings, and gates debt whose forfeiture cannot be judged",
    () => {
      const setUp = [
        scratch.removeTree({ path: REPO }),
        scratch.makeDirectory({ path: `${REPO}/src` }),
        fileText.write({ path: `${REPO}/hone.config.json`, text: CONFIG }),
        fileText.write({ path: `${REPO}/eslint.config.mjs`, text: ESLINT_CONFIG }),
        fileText.write({ path: `${REPO}/src/kept.ts`, text: CLASS_SOURCE }),
        fileText.write({ path: `${REPO}/src/cast.ts`, text: CAST_SOURCE }),
      ];
      const runs = {
        gitInit: commands.run({ command: "git", arguments: GIT_INIT, directory: REPO }),
        addBeforeProject: commands.run({ command: "git", arguments: GIT_ADD, directory: REPO }),
        project: commands.run({ command: "node", arguments: PROJECT, directory: REPO }),
        addProjection: commands.run({ command: "git", arguments: GIT_ADD, directory: REPO }),
        commitProjection: commands.run({ command: "git", arguments: GIT_COMMIT, directory: REPO }),
        checkElsewhere: commands.run({
          command: "node",
          arguments: CHECK_ELSEWHERE,
          directory: REPO,
        }),
        recordDebt: commands.run({ command: "node", arguments: RECORD_DEBT, directory: REPO }),
        projectDebt: commands.run({ command: "node", arguments: PROJECT, directory: REPO }),
        addDebt: commands.run({ command: "git", arguments: GIT_ADD, directory: REPO }),
        commitDebt: commands.run({ command: "git", arguments: GIT_COMMIT, directory: REPO }),
        checkUnmeasured: commands.run({ command: "node", arguments: CHECK, directory: REPO }),
        checkAgainstHead: commands.run({
          command: "node",
          arguments: CHECK_AGAINST_HEAD,
          directory: REPO,
        }),
      };
      expect({ setUp, runs }).toEqual({
        setUp: [DONE, DONE, WRITTEN, WRITTEN, WRITTEN, WRITTEN],
        runs: {
          gitInit: SUCCEEDED,
          addBeforeProject: SUCCEEDED,
          project: SUCCEEDED,
          addProjection: SUCCEEDED,
          commitProjection: SUCCEEDED,
          checkElsewhere: { outcome: "exited", exitCode: 1, output: ELSEWHERE_TEXT },
          recordDebt: SUCCEEDED,
          projectDebt: SUCCEEDED,
          addDebt: SUCCEEDED,
          commitDebt: SUCCEEDED,
          checkUnmeasured: { outcome: "exited", exitCode: 1, output: UNMEASURED_TEXT },
          checkAgainstHead: { outcome: "exited", exitCode: 0, output: MEASURED_TEXT },
        },
      });
    },
    EACH_STEP_IS_A_PROCESS_MILLISECONDS,
  );
});
