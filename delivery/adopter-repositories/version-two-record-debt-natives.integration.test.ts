import { afterAll, assert, describe, expect, it } from "vitest";

import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import {
  projectCommandOf,
  pruneCommandOf,
} from "../../src/infrastructure/command-line/arguments/tool-invocations.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import type { StepRun } from "../install-proof/install-proof-plan.ts";
import {
  createDefaultCommandRunPort,
  createDefaultScratchFilesPort,
} from "../install-proof/install-proof-ports.ts";

const INSTALL_ROOT = absolutePathSchema.parse(
  createDefaultPathPort({}).join({ segments: [`${import.meta.dirname}/..`, ".."] }),
);

const TOOL_COMMAND_FILE = `${INSTALL_ROOT}/src/hone.ts`;

const EACH_STEP_IS_A_PROCESS_MILLISECONDS = 120_000;

const fileText = createDefaultFileTextPort({});

const scratch = createDefaultScratchFilesPort({});

const INHERITED_REPO = absolutePathSchema.parse(`${INSTALL_ROOT}/artefacts/native-debt-inherited`);

const EXCLUDED_REPO = absolutePathSchema.parse(`${INSTALL_ROOT}/artefacts/native-debt-excluded`);

const HIDDEN_REPO = absolutePathSchema.parse(`${INSTALL_ROOT}/artefacts/native-debt-hidden`);

afterAll(() => {
  scratch.removeTree({ path: INHERITED_REPO });
  scratch.removeTree({ path: EXCLUDED_REPO });
  scratch.removeTree({ path: HIDDEN_REPO });
});

const commands = createDefaultCommandRunPort({});

const CONFIG = `{
  "version": 2,
  "ruleSets": {},
  "checks": {
    "authored-class-or-this#class-keyword": "eslint",
    "authored-class-or-this#static-members-only": "not-adopted",
    "claimed-type#cast-to-any": "not-adopted",
    "claimed-type#unlisted-cast-site": "walker",
    "claimed-type#non-null-assertions": "not-adopted"
  },
  "exclude": []
}
`;

const ESLINT_CONFIG = `import hone from "./hone.eslint.mjs";
export default [...hone];
`;

const ESLINT_CONFIG_WITH_OVERRIDE = `import hone from "./hone.eslint.mjs";
export default [...hone, { files: ["src/legacy-*.ts"], rules: { "hone/authored-class-or-this#class-keyword": "warn" } }];
`;

const CLEAN_LEGACY_SOURCE = "export const clean = 1;\n";

const CLASS_LEGACY_SOURCE = "export class Legacy {}\n";

const FIXED_CLASS_LEGACY_SOURCE = "export const legacy = 1;\n";

const CLASS_SOURCE = "export class Kept {}\n";

const INLINE_DISABLE_SOURCE =
  "// eslint-disable-next-line hone/authored-class-or-this#class-keyword\nexport const inherited = 1;\n";

const TYPE_DIRECTIVE_SOURCE = '// @ts-expect-error\nexport const wrong: number = "a";\n';

const FIXED_CLASS_SOURCE = "export const kept = 1;\n";

const FIXED_DISABLE_SOURCE = "export const inherited = 1;\n";

const FIXED_DIRECTIVE_SOURCE = "export const wrong = 1;\n";

const GIT_IDENTITY = [
  "-c",
  "user.name=adopter",
  "-c",
  "user.email=adopter@example.test",
  "-c",
  "commit.gpgsign=false",
];

const GIT_INIT = ["init", "-q"];

const GIT_ADD = ["add", "."];

const GIT_COMMIT = ["commit", "-q", "-m", "commit"];

const DONE = { outcome: "ok", value: null };

const WRITTEN = { outcome: "ok", value: undefined };

const SUCCEEDED = { outcome: "exited", exitCode: 0 };

const runGit = (request: {
  readonly repo: AbsolutePath;
  readonly arguments: readonly string[];
}): StepRun =>
  commands.run({
    command: "git",
    arguments: [
      "--git-dir",
      `${request.repo}/.git`,
      "--work-tree",
      request.repo,
      ...GIT_IDENTITY,
      ...request.arguments,
    ],
    directory: request.repo,
  });

const runHone = (request: {
  readonly repo: AbsolutePath;
  readonly subcommand: string;
  readonly options: readonly string[];
}): StepRun =>
  commands.run({
    command: "node",
    arguments: [TOOL_COMMAND_FILE, request.subcommand, "--repo", request.repo, ...request.options],
    directory: request.repo,
  });

const writeIn = (request: {
  readonly repo: AbsolutePath;
  readonly file: string;
  readonly text: string;
}) => fileText.write({ path: `${request.repo}/${request.file}`, text: request.text });

const createProjectedBase = ({ repo }: { readonly repo: AbsolutePath }): readonly StepRun[] => [
  runGit({ repo, arguments: GIT_ADD }),
  runHone({ repo, subcommand: "project", options: [] }),
  runGit({ repo, arguments: GIT_ADD }),
  runGit({ repo, arguments: GIT_COMMIT }),
];

const BASE_CREATED = [SUCCEEDED, SUCCEEDED, SUCCEEDED, SUCCEEDED];

const AT_HEAD = ["--base-revision", "HEAD"];

const FORFEITURE_ELSEWHERE = ["--forfeiture", "elsewhere"];

const PATH = createDefaultPathPort({});

const ENTRY_URL = new URL("../../src/hone.ts", import.meta.url).href;

const pruneCommandIn = (request: { readonly repo: AbsolutePath }) =>
  pruneCommandOf({
    path: PATH,
    moduleUrl: ENTRY_URL,
    repoRoot: request.repo,
    baseRevision: undefined,
    forfeiture: "elsewhere",
  });

const projectCommandIn = (request: { readonly repo: AbsolutePath }) =>
  projectCommandOf({
    path: PATH,
    moduleUrl: ENTRY_URL,
    repoRoot: request.repo,
  });

const NOT_ADOPTED =
  "not-adopted (3)\nauthored-class-or-this#static-members-only\nclaimed-type#cast-to-any\nclaimed-type#non-null-assertions\n";

const CLASS_SYMPTOM =
  "authored-class-or-this: Authored class or this. May indicate: keeps state or settings across calls → No hidden effects; reuses behaviour from another unit or type → One reason per module; gives a value its type (declares it, or needs it narrower) → Declared, not asserted. The breach usually sits in the unit. Recipe: Closure factory. Read ../../rules/typescript/symptoms.md#authored-class-or-this\n";

const INHERITED_TEXT = `${NOT_ADOPTED}findings (2)
authored-class-or-this#class-keyword eslint src/kept.ts:1:7 export class Kept {} symptom: authored-class-or-this (../../rules/typescript/symptoms.md#authored-class-or-this) may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted
authored-class-or-this#class-keyword eslint src/legacy-class.ts:1:7 export class Legacy {} symptom: authored-class-or-this (../../rules/typescript/symptoms.md#authored-class-or-this) may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted
unrecorded (4)
authored-class-or-this#class-keyword eslint config-override src/legacy-class.ts
authored-class-or-this#class-keyword eslint config-override src/legacy-clean.ts
authored-class-or-this#class-keyword eslint inline-disable src/disabled.ts:1 // eslint-disable-next-line hone/authored-class-or-this#class-keyword
claimed-type#unlisted-cast-site walker inline-disable src/directive.ts:1 // @ts-expect-error
assessment (1)
forfeiture elsewhere: 0 debt records not checked for forfeiture in this run
symptoms (1)
${CLASS_SYMPTOM}verdict: fail (partial assessment)
`;

const OVERRIDE_DETAIL =
  "an override in the ESLint configuration turns the check down for this file, which no record can hold; where debt holds the check the projection already turns it off, so remove the override or narrow it to the files that need it";

const writeInheritedFiles = ({ repo }: { readonly repo: AbsolutePath }) => [
  scratch.removeTree({ path: repo }),
  scratch.makeDirectory({ path: `${repo}/src` }),
  writeIn({ repo, file: "hone.config.json", text: CONFIG }),
  writeIn({ repo, file: "eslint.config.mjs", text: ESLINT_CONFIG_WITH_OVERRIDE }),
  writeIn({ repo, file: "src/kept.ts", text: CLASS_SOURCE }),
  writeIn({ repo, file: "src/disabled.ts", text: INLINE_DISABLE_SOURCE }),
  writeIn({ repo, file: "src/directive.ts", text: TYPE_DIRECTIVE_SOURCE }),
  writeIn({ repo, file: "src/legacy-clean.ts", text: CLEAN_LEGACY_SOURCE }),
  writeIn({ repo, file: "src/legacy-class.ts", text: CLASS_LEGACY_SOURCE }),
];

const INHERITED_FILES_WRITTEN = [
  DONE,
  DONE,
  WRITTEN,
  WRITTEN,
  WRITTEN,
  WRITTEN,
  WRITTEN,
  WRITTEN,
  WRITTEN,
];

const recordedText = (request: {
  readonly projectCommand: string;
}): string => `claimed-type#unlisted-cast-site recorded src/directive.ts
authored-class-or-this#class-keyword recorded src/disabled.ts
authored-class-or-this#class-keyword recorded src/kept.ts
authored-class-or-this#class-keyword recorded src/legacy-class.ts
authored-class-or-this#class-keyword unrecordable src/legacy-class.ts: ${OVERRIDE_DETAIL}
authored-class-or-this#class-keyword unrecordable src/legacy-clean.ts: ${OVERRIDE_DETAIL}
run ${request.projectCommand} to put the recorded debt into effect
`;

const ADOPTED_TEXT = `${NOT_ADOPTED}answered (2)
authored-class-or-this#class-keyword eslint src/kept.ts:1:7 export class Kept {} answered by debt
authored-class-or-this#class-keyword eslint src/legacy-class.ts:1:7 export class Legacy {} answered by debt
held (2)
authored-class-or-this#class-keyword eslint inline-disable src/disabled.ts:1 // eslint-disable-next-line hone/authored-class-or-this#class-keyword held by debt
claimed-type#unlisted-cast-site walker inline-disable src/directive.ts:1 // @ts-expect-error held by debt
verdict: pass
`;

const stale = (request: {
  readonly pruneCommand: string;
  readonly check: string;
  readonly file: string;
}): string =>
  `${request.check} debt ${request.file}; nothing it holds is found: run ${request.pruneCommand} to remove it\n`;

const paidText = (request: { readonly pruneCommand: string }): string =>
  `${NOT_ADOPTED}stale (4)
${stale({ pruneCommand: request.pruneCommand, check: "authored-class-or-this#class-keyword", file: "src/disabled.ts" })}${stale({ pruneCommand: request.pruneCommand, check: "authored-class-or-this#class-keyword", file: "src/kept.ts" })}${stale({ pruneCommand: request.pruneCommand, check: "authored-class-or-this#class-keyword", file: "src/legacy-class.ts" })}${stale({ pruneCommand: request.pruneCommand, check: "claimed-type#unlisted-cast-site", file: "src/directive.ts" })}assessment (1)
forfeiture elsewhere: 4 debt records not checked for forfeiture in this run
verdict: fail (partial assessment)
`;

const PRUNED_TEXT = `authored-class-or-this#class-keyword removed src/disabled.ts: stale
authored-class-or-this#class-keyword removed src/kept.ts: stale
authored-class-or-this#class-keyword removed src/legacy-class.ts: stale
claimed-type#unlisted-cast-site removed src/directive.ts: stale
`;

describe("hone record-debt over a repository that inherits a finding, an inline disable and a TypeScript directive, run as the real tool command", () => {
  it(
    "goes red, records the debt each needs, and goes green with a base revision once projected; paying it makes the debt prunable",
    () => {
      const repo = INHERITED_REPO;
      expect(writeInheritedFiles({ repo })).toMatchObject(INHERITED_FILES_WRITTEN);
      expect(runGit({ repo, arguments: GIT_INIT })).toMatchObject(SUCCEEDED);
      expect(createProjectedBase({ repo })).toMatchObject(BASE_CREATED);

      const inherited = runHone({ repo, subcommand: "check", options: FORFEITURE_ELSEWHERE });
      const recorded = runHone({ repo, subcommand: "record-debt", options: AT_HEAD });
      expect(writeIn({ repo, file: "eslint.config.mjs", text: ESLINT_CONFIG })).toEqual(WRITTEN);
      const projected = runHone({ repo, subcommand: "project", options: [] });
      expect(runGit({ repo, arguments: GIT_ADD })).toMatchObject(SUCCEEDED);
      const adopted = runHone({ repo, subcommand: "check", options: AT_HEAD });

      expect([
        runGit({ repo, arguments: GIT_ADD }),
        runGit({ repo, arguments: GIT_COMMIT }),
        writeIn({ repo, file: "src/kept.ts", text: FIXED_CLASS_SOURCE }),
        writeIn({ repo, file: "src/disabled.ts", text: FIXED_DISABLE_SOURCE }),
        writeIn({ repo, file: "src/directive.ts", text: FIXED_DIRECTIVE_SOURCE }),
        writeIn({ repo, file: "src/legacy-class.ts", text: FIXED_CLASS_LEGACY_SOURCE }),
        runGit({ repo, arguments: GIT_ADD }),
      ]).toMatchObject([SUCCEEDED, SUCCEEDED, WRITTEN, WRITTEN, WRITTEN, WRITTEN, SUCCEEDED]);
      const paid = runHone({ repo, subcommand: "check", options: FORFEITURE_ELSEWHERE });
      const pruned = runHone({ repo, subcommand: "prune-debt", options: FORFEITURE_ELSEWHERE });
      const project = projectCommandIn({ repo });
      const prune = pruneCommandIn({ repo });

      assert(project.outcome === "ok", "the project command is made");
      assert(prune.outcome === "ok", "the prune command is made");
      expect({ inherited, recorded, projected, adopted, paid, pruned }).toEqual({
        inherited: { outcome: "exited", output: INHERITED_TEXT, exitCode: 1 },
        recorded: {
          outcome: "exited",
          output: recordedText({ projectCommand: project.value }),
          exitCode: 0,
        },
        projected: {
          outcome: "exited",
          output: "hone.eslint.mjs written\nhone.eslint.d.mts unchanged\n",
          exitCode: 0,
        },
        adopted: { outcome: "exited", output: ADOPTED_TEXT, exitCode: 0 },
        paid: { outcome: "exited", output: paidText({ pruneCommand: prune.value }), exitCode: 1 },
        pruned: { outcome: "exited", output: PRUNED_TEXT, exitCode: 0 },
      });
    },
    EACH_STEP_IS_A_PROCESS_MILLISECONDS,
  );
});

const ESLINT_CONFIG_IGNORING = `import hone from "./hone.eslint.mjs";
export default [...hone, { ignores: ["src/ignored.ts"] }];
`;

const SUPPRESSIONS = `{ "src/suppressed.ts": { "hone/authored-class-or-this#class-keyword": { "count": 1 } } }
`;

const writeHiddenFiles = ({ repo }: { readonly repo: AbsolutePath }) => [
  scratch.removeTree({ path: repo }),
  scratch.makeDirectory({ path: `${repo}/src` }),
  writeIn({ repo, file: "hone.config.json", text: CONFIG }),
  writeIn({ repo, file: "eslint.config.mjs", text: ESLINT_CONFIG_IGNORING }),
  writeIn({ repo, file: "eslint-suppressions.json", text: SUPPRESSIONS }),
  writeIn({ repo, file: "src/ignored.ts", text: CLASS_SOURCE }),
  writeIn({ repo, file: "src/suppressed.ts", text: CLASS_SOURCE }),
];

const HIDDEN_FILES_WRITTEN = [DONE, DONE, WRITTEN, WRITTEN, WRITTEN, WRITTEN, WRITTEN];

const HIDDEN_FINDINGS = `authored-class-or-this#class-keyword eslint src/ignored.ts:1:7 export class Kept {} symptom: authored-class-or-this (../../rules/typescript/symptoms.md#authored-class-or-this) may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted
authored-class-or-this#class-keyword eslint src/suppressed.ts:1:7 export class Kept {} symptom: authored-class-or-this (../../rules/typescript/symptoms.md#authored-class-or-this) may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted
`;

const HIDDEN_UNRECORDED = `authored-class-or-this#class-keyword eslint ignore src/ignored.ts
authored-class-or-this#class-keyword eslint suppression-entry src/suppressed.ts eslint-suppressions.json
`;

const HIDDEN_ANSWERED = `authored-class-or-this#class-keyword eslint src/ignored.ts:1:7 export class Kept {} answered by debt
authored-class-or-this#class-keyword eslint src/suppressed.ts:1:7 export class Kept {} answered by debt
`;

const HIDDEN_INHERITED_TEXT = `${NOT_ADOPTED}findings (2)
${HIDDEN_FINDINGS}unrecorded (2)
${HIDDEN_UNRECORDED}assessment (1)
forfeiture elsewhere: 0 debt records not checked for forfeiture in this run
symptoms (1)
${CLASS_SYMPTOM}verdict: fail (partial assessment)
`;

const IGNORE_DETAIL =
  "an ESLint ignore leaves the file out of the team's lint run, which no record can hold; Hone's run checked the file and recorded what it found there as debt, so what is left is the ignore: remove it, or, if the file is generated or vendored and not yours to hold to the checks, list it in exclude in hone.config.json so Hone's setting and the team's ignore agree";

const SUPPRESSION_DETAIL =
  "an entry in the suppressions file hides a finding from the team's lint run, which no record can hold; Hone's run still finds it and records it as debt, so remove the entry from the suppressions file";

const hiddenRecordedText = (request: {
  readonly projectCommand: string;
}): string => `authored-class-or-this#class-keyword recorded src/ignored.ts
authored-class-or-this#class-keyword unrecordable src/ignored.ts: ${IGNORE_DETAIL}
authored-class-or-this#class-keyword recorded src/suppressed.ts
authored-class-or-this#class-keyword unrecordable src/suppressed.ts: ${SUPPRESSION_DETAIL}
run ${request.projectCommand} to put the recorded debt into effect
`;

const STILL_HIDDEN_TEXT = `${NOT_ADOPTED}answered (2)
${HIDDEN_ANSWERED}unrecorded (2)
${HIDDEN_UNRECORDED}verdict: fail
`;

const HIDDEN_ADOPTED_TEXT = `${NOT_ADOPTED}answered (2)
${HIDDEN_ANSWERED}verdict: pass
`;

const CONFIG_EXCLUDING_SOME_IGNORED = `{
  "version": 2,
  "ruleSets": {},
  "checks": {
    "authored-class-or-this#class-keyword": "eslint",
    "authored-class-or-this#static-members-only": "not-adopted",
    "claimed-type#cast-to-any": "not-adopted",
    "claimed-type#unlisted-cast-site": "walker",
    "claimed-type#non-null-assertions": "not-adopted"
  },
  "exclude": [
    "src/ignored.ts",
    "src/vendor-a.ts"
  ]
}
`;

const ESLINT_CONFIG_IGNORING_VENDORED = `import hone from "./hone.eslint.mjs";
export default [...hone, { ignores: ["src/ignored.ts", "src/vendor-*.ts"] }];
`;

const EXCLUDED_CHECK_TEXT = `excluded (2)
src/ignored.ts
src/vendor-a.ts
not-adopted (3)
authored-class-or-this#static-members-only
claimed-type#cast-to-any
claimed-type#non-null-assertions
findings (1)
authored-class-or-this#class-keyword eslint src/vendor-b.ts:1:7 export class Kept {} symptom: authored-class-or-this (../../rules/typescript/symptoms.md#authored-class-or-this) may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted
unrecorded (1)
authored-class-or-this#class-keyword eslint ignore src/vendor-b.ts
symptoms (1)
${CLASS_SYMPTOM}verdict: fail
`;

const writeExcludedFiles = ({ repo }: { readonly repo: AbsolutePath }) => [
  scratch.removeTree({ path: repo }),
  scratch.makeDirectory({ path: `${repo}/src` }),
  writeIn({ repo, file: "hone.config.json", text: CONFIG_EXCLUDING_SOME_IGNORED }),
  writeIn({ repo, file: "eslint.config.mjs", text: ESLINT_CONFIG_IGNORING_VENDORED }),
  writeIn({ repo, file: "src/ignored.ts", text: CLASS_SOURCE }),
  writeIn({ repo, file: "src/vendor-a.ts", text: CLASS_SOURCE }),
  writeIn({ repo, file: "src/vendor-b.ts", text: CLASS_SOURCE }),
];

const EXCLUDED_FILES_WRITTEN = [DONE, DONE, WRITTEN, WRITTEN, WRITTEN, WRITTEN, WRITTEN];

const excludedRecordedText = (request: {
  readonly projectCommand: string;
}): string => `authored-class-or-this#class-keyword recorded src/vendor-b.ts
authored-class-or-this#class-keyword unrecordable src/vendor-b.ts: ${IGNORE_DETAIL}
run ${request.projectCommand} to put the recorded debt into effect
`;

describe("hone over a repository whose ESLint configuration ignores files that Hone's exclude lists only in part, run as the real tool command", () => {
  it(
    "prints no ignore line for an excluded file, and the line naming both routes for an ignored file that is not excluded",
    () => {
      const repo = EXCLUDED_REPO;
      expect(writeExcludedFiles({ repo })).toMatchObject(EXCLUDED_FILES_WRITTEN);
      expect(runGit({ repo, arguments: GIT_INIT })).toMatchObject(SUCCEEDED);
      expect(createProjectedBase({ repo })).toMatchObject(BASE_CREATED);

      const checked = runHone({ repo, subcommand: "check", options: [] });
      const recorded = runHone({ repo, subcommand: "record-debt", options: AT_HEAD });
      const project = projectCommandIn({ repo });

      assert(project.outcome === "ok", "the project command is made");
      expect({ checked, recorded }).toEqual({
        checked: { outcome: "exited", output: EXCLUDED_CHECK_TEXT, exitCode: 1 },
        recorded: {
          outcome: "exited",
          output: excludedRecordedText({ projectCommand: project.value }),
          exitCode: 0,
        },
      });
    },
    EACH_STEP_IS_A_PROCESS_MILLISECONDS,
  );
});

describe("hone record-debt over a repository whose ESLint configuration ignores a file and whose suppressions file hides another, run as the real tool command", () => {
  it(
    "records the findings Hone's own run finds there, and goes green once the ignore and the entry are removed",
    () => {
      const repo = HIDDEN_REPO;
      expect(writeHiddenFiles({ repo })).toMatchObject(HIDDEN_FILES_WRITTEN);
      expect(runGit({ repo, arguments: GIT_INIT })).toMatchObject(SUCCEEDED);
      expect(createProjectedBase({ repo })).toMatchObject(BASE_CREATED);

      const inherited = runHone({ repo, subcommand: "check", options: FORFEITURE_ELSEWHERE });
      const recorded = runHone({ repo, subcommand: "record-debt", options: AT_HEAD });
      const projected = runHone({ repo, subcommand: "project", options: [] });
      expect(runGit({ repo, arguments: GIT_ADD })).toMatchObject(SUCCEEDED);
      const stillHidden = runHone({ repo, subcommand: "check", options: AT_HEAD });
      expect([
        writeIn({ repo, file: "eslint.config.mjs", text: ESLINT_CONFIG }),
        runGit({ repo, arguments: ["rm", "-q", "-f", "eslint-suppressions.json"] }),
      ]).toMatchObject([WRITTEN, SUCCEEDED]);
      const reprojected = runHone({ repo, subcommand: "project", options: [] });
      expect(runGit({ repo, arguments: GIT_ADD })).toMatchObject(SUCCEEDED);
      const adopted = runHone({ repo, subcommand: "check", options: AT_HEAD });
      const project = projectCommandIn({ repo });

      assert(project.outcome === "ok", "the project command is made");
      expect({ inherited, recorded, projected, stillHidden, reprojected, adopted }).toEqual({
        inherited: { outcome: "exited", output: HIDDEN_INHERITED_TEXT, exitCode: 1 },
        recorded: {
          outcome: "exited",
          output: hiddenRecordedText({ projectCommand: project.value }),
          exitCode: 0,
        },
        projected: {
          outcome: "exited",
          output: "hone.eslint.mjs written\nhone.eslint.d.mts unchanged\n",
          exitCode: 0,
        },
        stillHidden: { outcome: "exited", output: STILL_HIDDEN_TEXT, exitCode: 1 },
        reprojected: {
          outcome: "exited",
          output: "hone.eslint.mjs unchanged\nhone.eslint.d.mts unchanged\n",
          exitCode: 0,
        },
        adopted: { outcome: "exited", output: HIDDEN_ADOPTED_TEXT, exitCode: 0 },
      });
    },
    EACH_STEP_IS_A_PROCESS_MILLISECONDS,
  );
});
