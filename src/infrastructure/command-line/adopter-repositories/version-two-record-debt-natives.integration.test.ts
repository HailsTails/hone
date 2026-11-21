import { afterAll, assert, describe, expect, it } from "vitest";
import { projectCommandOf, pruneCommandOf } from "../arguments/tool-invocations.ts";
import { createDefaultFileTextPort, type FileTextPort } from "../../node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../node/path-port.ts";
import { absolutePathSchema } from "../../content-files/absolute-path.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { createDefaultCommandRunPort, createDefaultScratchFilesPort, type ScratchFilesPort } from "../../../../delivery/install-proof/install-proof-ports.ts";

type ScratchRepositories = {
  readonly repositoryWith: (request: { readonly files: Readonly<Record<string, string>> }) => AbsolutePath;
  readonly removeAll: () => void;
};

const scratchRepositoriesUnder = (request: {
  readonly parent: string;
  readonly fileText: FileTextPort;
  readonly scratch: ScratchFilesPort;
}): ScratchRepositories => {
  const made: AbsolutePath[] = [];
  return {
    repositoryWith: (repository) => {
      const folder = absolutePathSchema.parse(`${request.parent.replaceAll("\\", "/")}/scratch-${globalThis.crypto.randomUUID()}`);
      const directory = request.scratch.makeDirectory({ path: folder });
      if (directory.outcome !== "ok") {
        throw new Error(`a scratch folder could not be made at ${folder}: ${directory.error.detail}`);
      }
      made.push(folder);
      Object.entries(repository.files).forEach(([name, text]) => {
        request.fileText.write({ path: `${folder}/${name}`, text });
      });
      return folder;
    },
    removeAll: () => {
      made.forEach((folder) => {
        request.scratch.removeTree({ path: folder });
      });
    },
  };
};

const repositoryWithSubfolder = (request: {
  readonly repositories: ScratchRepositories;
  readonly scratch: Pick<ScratchFilesPort, "makeDirectory">;
  readonly fileText: Pick<FileTextPort, "write">;
  readonly files: Readonly<Record<string, string>>;
  readonly subfolder: string;
  readonly subfolderFiles: Readonly<Record<string, string>>;
}): AbsolutePath => {
  const repo = request.repositories.repositoryWith({ files: request.files });
  const folder = `${repo}/${request.subfolder}`;
  const made = request.scratch.makeDirectory({ path: folder });
  if (made.outcome !== "ok") {
    throw new Error(`a scratch subfolder could not be made at ${folder}: ${made.error.detail}`);
  }
  Object.entries(request.subfolderFiles).forEach(([name, text]) => {
    const written = request.fileText.write({ path: `${folder}/${name}`, text });
    if (written.outcome !== "ok") {
      throw new Error(`a scratch file could not be written at ${folder}/${name}: ${written.error.detail}`);
    }
  });
  return repo;
};

const INSTALL_ROOT = absolutePathSchema.parse(createDefaultPathPort({}).join({ segments: [`${import.meta.dirname}/../../..`, ".."] }));

const TOOL_COMMAND_FILE = `${INSTALL_ROOT}/src/hone.ts`;

const EACH_STEP_IS_A_PROCESS_MILLISECONDS = 120_000;

const fileText = createDefaultFileTextPort({});

const scratch = createDefaultScratchFilesPort({});

const repositories = scratchRepositoriesUnder({ parent: `${INSTALL_ROOT}/artefacts`, fileText, scratch });

afterAll(() => {
  repositories.removeAll();
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

const INLINE_DISABLE_SOURCE = "// eslint-disable-next-line hone/authored-class-or-this#class-keyword\nexport const inherited = 1;\n";

const TYPE_DIRECTIVE_SOURCE = '// @ts-expect-error\nexport const wrong: number = "a";\n';

const FIXED_CLASS_SOURCE = "export const kept = 1;\n";

const FIXED_DISABLE_SOURCE = "export const inherited = 1;\n";

const FIXED_DIRECTIVE_SOURCE = "export const wrong = 1;\n";

const GIT_IDENTITY = ["-c", "user.name=adopter", "-c", "user.email=adopter@example.test", "-c", "commit.gpgsign=false"];

type Printed = { readonly text: string; readonly code: number };

const git = (request: { readonly repo: string; readonly arguments: readonly string[] }): void => {
  const run = commands.run({ command: "git", arguments: [...GIT_IDENTITY, ...request.arguments], directory: request.repo });
  assert(run.outcome === "exited", "a git step in the scratch repository ran to an exit");
  assert(run.exitCode === 0, "a git step in the scratch repository succeeded");
};

const toolIn = (request: { readonly repo: string; readonly subcommand: string; readonly options: readonly string[] }): Printed => {
  const run = commands.run({
    command: "node",
    arguments: [TOOL_COMMAND_FILE, request.subcommand, "--repo", request.repo, ...request.options],
    directory: request.repo,
  });
  assert(run.outcome === "exited", "the tool command ran to an exit");
  return { text: run.output, code: run.exitCode };
};

const trackEverything = (request: { readonly repo: string }): void => {
  git({ repo: request.repo, arguments: ["add", "."] });
};

const commitEverything = (request: { readonly repo: string }): void => {
  trackEverything(request);
  git({ repo: request.repo, arguments: ["commit", "-q", "-m", "commit"] });
};

const writeIn = (request: { readonly repo: string; readonly file: string; readonly text: string }): void => {
  const written = fileText.write({ path: `${request.repo}/${request.file}`, text: request.text });
  assert(written.outcome === "ok", "the scratch file is written");
};

const inheritingRepository = (): string => {
  const repo = repositoryWithSubfolder({
    repositories,
    scratch,
    fileText,
    files: { "hone.config.json": CONFIG, "eslint.config.mjs": ESLINT_CONFIG_WITH_OVERRIDE },
    subfolder: "src",
    subfolderFiles: { "kept.ts": CLASS_SOURCE, "disabled.ts": INLINE_DISABLE_SOURCE, "directive.ts": TYPE_DIRECTIVE_SOURCE, "legacy-clean.ts": CLEAN_LEGACY_SOURCE, "legacy-class.ts": CLASS_LEGACY_SOURCE },
  });
  git({ repo, arguments: ["init", "-q"] });
  trackEverything({ repo });
  return repo;
};

const FORFEITURE_ELSEWHERE = ["--forfeiture", "elsewhere"];

const PATH = createDefaultPathPort({});

const ENTRY_URL = new URL("../../../hone.ts", import.meta.url).href;

const pruneCommandIn = (request: { readonly repo: string }): string => {
  const command = pruneCommandOf({ path: PATH, moduleUrl: ENTRY_URL, repoRoot: absolutePathSchema.parse(request.repo), baseRevision: undefined, forfeiture: "elsewhere" });
  assert(command.outcome === "ok", "the prune command is made");
  return command.value;
};

const projectCommandIn = (request: { readonly repo: string }): string => {
  const command = projectCommandOf({ path: PATH, moduleUrl: ENTRY_URL, repoRoot: absolutePathSchema.parse(request.repo) });
  assert(command.outcome === "ok", "the project command is made");
  return command.value;
};

const NOT_ADOPTED = "not-adopted (3)\nauthored-class-or-this#static-members-only\nclaimed-type#cast-to-any\nclaimed-type#non-null-assertions\n";

const CLASS_SYMPTOM =
  "authored-class-or-this: Authored class or this. May indicate: keeps state or settings across calls → No hidden effects; reuses behaviour from another unit or type → One reason per module; gives a value its type (declares it, or needs it narrower) → Declared, not asserted. The breach usually sits in the unit. Recipe: Closure factory. Known debt: debt. Read ../../rules/typescript/symptoms.md#authored-class-or-this\n";

const INHERITED_TEXT = `${NOT_ADOPTED}findings (2)
authored-class-or-this#class-keyword eslint src/kept.ts:1:7 export class Kept {} may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted
authored-class-or-this#class-keyword eslint src/legacy-class.ts:1:7 export class Legacy {} may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted
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

const recordedText = (request: { readonly repo: string }): string => `claimed-type#unlisted-cast-site recorded src/directive.ts
authored-class-or-this#class-keyword recorded src/disabled.ts
authored-class-or-this#class-keyword recorded src/kept.ts
authored-class-or-this#class-keyword recorded src/legacy-class.ts
authored-class-or-this#class-keyword unrecordable src/legacy-class.ts: ${OVERRIDE_DETAIL}
authored-class-or-this#class-keyword unrecordable src/legacy-clean.ts: ${OVERRIDE_DETAIL}
run ${projectCommandIn({ repo: request.repo })} to put the recorded debt into effect
`;

const ADOPTED_TEXT = `${NOT_ADOPTED}answered (2)
authored-class-or-this#class-keyword eslint src/kept.ts:1:7 export class Kept {} answered by debt
authored-class-or-this#class-keyword eslint src/legacy-class.ts:1:7 export class Legacy {} answered by debt
verdict: pass
`;

const stale = (request: { readonly repo: string; readonly check: string; readonly file: string }): string =>
  `${request.check} debt ${request.file}; nothing it holds is found: run ${pruneCommandIn({ repo: request.repo })} to remove it\n`;

const paidText = (request: { readonly repo: string }): string =>
  `${NOT_ADOPTED}stale (4)
${stale({ repo: request.repo, check: "authored-class-or-this#class-keyword", file: "src/disabled.ts" })}${stale({ repo: request.repo, check: "authored-class-or-this#class-keyword", file: "src/kept.ts" })}${stale({ repo: request.repo, check: "authored-class-or-this#class-keyword", file: "src/legacy-class.ts" })}${stale({ repo: request.repo, check: "claimed-type#unlisted-cast-site", file: "src/directive.ts" })}assessment (1)
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
      const repo = inheritingRepository();
      toolIn({ repo, subcommand: "project", options: [] });
      commitEverything({ repo });
      const inherited = toolIn({ repo, subcommand: "check", options: FORFEITURE_ELSEWHERE });
      const recorded = toolIn({ repo, subcommand: "record-debt", options: ["--base-revision", "HEAD"] });
      writeIn({ repo, file: "eslint.config.mjs", text: ESLINT_CONFIG });
      const projected = toolIn({ repo, subcommand: "project", options: [] });
      trackEverything({ repo });
      const adopted = toolIn({ repo, subcommand: "check", options: ["--base-revision", "HEAD"] });
      commitEverything({ repo });
      writeIn({ repo, file: "src/kept.ts", text: FIXED_CLASS_SOURCE });
      writeIn({ repo, file: "src/disabled.ts", text: FIXED_DISABLE_SOURCE });
      writeIn({ repo, file: "src/directive.ts", text: FIXED_DIRECTIVE_SOURCE });
      writeIn({ repo, file: "src/legacy-class.ts", text: FIXED_CLASS_LEGACY_SOURCE });
      trackEverything({ repo });
      const paid = toolIn({ repo, subcommand: "check", options: FORFEITURE_ELSEWHERE });
      const pruned = toolIn({ repo, subcommand: "prune-debt", options: FORFEITURE_ELSEWHERE });
      expect({ inherited, recorded, projected, adopted, paid, pruned }).toEqual({
        inherited: { text: INHERITED_TEXT, code: 1 },
        recorded: { text: recordedText({ repo }), code: 0 },
        projected: { text: "hone.eslint.mjs written\nhone.eslint.d.mts unchanged\n", code: 0 },
        adopted: { text: ADOPTED_TEXT, code: 0 },
        paid: { text: paidText({ repo }), code: 1 },
        pruned: { text: PRUNED_TEXT, code: 0 },
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

const hidingRepository = (): string => {
  const repo = repositoryWithSubfolder({
    repositories,
    scratch,
    fileText,
    files: { "hone.config.json": CONFIG, "eslint.config.mjs": ESLINT_CONFIG_IGNORING, "eslint-suppressions.json": SUPPRESSIONS },
    subfolder: "src",
    subfolderFiles: { "ignored.ts": CLASS_SOURCE, "suppressed.ts": CLASS_SOURCE },
  });
  git({ repo, arguments: ["init", "-q"] });
  trackEverything({ repo });
  return repo;
};

const HIDDEN_FINDINGS = `authored-class-or-this#class-keyword eslint src/ignored.ts:1:7 export class Kept {} may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted
authored-class-or-this#class-keyword eslint src/suppressed.ts:1:7 export class Kept {} may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted
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

const hiddenRecordedText = (request: { readonly repo: string }): string => `authored-class-or-this#class-keyword recorded src/ignored.ts
authored-class-or-this#class-keyword unrecordable src/ignored.ts: ${IGNORE_DETAIL}
authored-class-or-this#class-keyword recorded src/suppressed.ts
authored-class-or-this#class-keyword unrecordable src/suppressed.ts: ${SUPPRESSION_DETAIL}
run ${projectCommandIn({ repo: request.repo })} to put the recorded debt into effect
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

const excludingRepository = (): string => {
  const repo = repositoryWithSubfolder({
    repositories,
    scratch,
    fileText,
    files: { "hone.config.json": CONFIG_EXCLUDING_SOME_IGNORED, "eslint.config.mjs": ESLINT_CONFIG_IGNORING_VENDORED },
    subfolder: "src",
    subfolderFiles: { "ignored.ts": CLASS_SOURCE, "vendor-a.ts": CLASS_SOURCE, "vendor-b.ts": CLASS_SOURCE },
  });
  git({ repo, arguments: ["init", "-q"] });
  trackEverything({ repo });
  return repo;
};

const EXCLUDED_CHECK_TEXT = `excluded (2)
src/ignored.ts
src/vendor-a.ts
not-adopted (3)
authored-class-or-this#static-members-only
claimed-type#cast-to-any
claimed-type#non-null-assertions
findings (1)
authored-class-or-this#class-keyword eslint src/vendor-b.ts:1:7 export class Kept {} may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted
unrecorded (1)
authored-class-or-this#class-keyword eslint ignore src/vendor-b.ts
symptoms (1)
${CLASS_SYMPTOM}verdict: fail
`;

const excludedRecordedText = (request: { readonly repo: string }): string => `authored-class-or-this#class-keyword recorded src/vendor-b.ts
authored-class-or-this#class-keyword unrecordable src/vendor-b.ts: ${IGNORE_DETAIL}
run ${projectCommandIn({ repo: request.repo })} to put the recorded debt into effect
`;

describe("hone over a repository whose ESLint configuration ignores files that Hone's exclude lists only in part, run as the real tool command", () => {
  it(
    "prints no ignore line for an excluded file, and the line naming both routes for an ignored file that is not excluded",
    () => {
      const repo = excludingRepository();
      toolIn({ repo, subcommand: "project", options: [] });
      commitEverything({ repo });
      const checked = toolIn({ repo, subcommand: "check", options: [] });
      const recorded = toolIn({ repo, subcommand: "record-debt", options: ["--base-revision", "HEAD"] });
      expect({ checked, recorded }).toEqual({
        checked: { text: EXCLUDED_CHECK_TEXT, code: 1 },
        recorded: { text: excludedRecordedText({ repo }), code: 0 },
      });
    },
    EACH_STEP_IS_A_PROCESS_MILLISECONDS,
  );
});

describe("hone record-debt over a repository whose ESLint configuration ignores a file and whose suppressions file hides another, run as the real tool command", () => {
  it(
    "records the findings Hone's own run finds there, and goes green once the ignore and the entry are removed",
    () => {
      const repo = hidingRepository();
      toolIn({ repo, subcommand: "project", options: [] });
      commitEverything({ repo });
      const inherited = toolIn({ repo, subcommand: "check", options: FORFEITURE_ELSEWHERE });
      const recorded = toolIn({ repo, subcommand: "record-debt", options: ["--base-revision", "HEAD"] });
      const projected = toolIn({ repo, subcommand: "project", options: [] });
      trackEverything({ repo });
      const stillHidden = toolIn({ repo, subcommand: "check", options: ["--base-revision", "HEAD"] });
      writeIn({ repo, file: "eslint.config.mjs", text: ESLINT_CONFIG });
      git({ repo, arguments: ["rm", "-q", "-f", "eslint-suppressions.json"] });
      const reprojected = toolIn({ repo, subcommand: "project", options: [] });
      trackEverything({ repo });
      const adopted = toolIn({ repo, subcommand: "check", options: ["--base-revision", "HEAD"] });
      expect({ inherited, recorded, projected, stillHidden, reprojected, adopted }).toEqual({
        inherited: { text: HIDDEN_INHERITED_TEXT, code: 1 },
        recorded: { text: hiddenRecordedText({ repo }), code: 0 },
        projected: { text: "hone.eslint.mjs written\nhone.eslint.d.mts unchanged\n", code: 0 },
        stillHidden: { text: STILL_HIDDEN_TEXT, code: 1 },
        reprojected: { text: "hone.eslint.mjs unchanged\nhone.eslint.d.mts unchanged\n", code: 0 },
        adopted: { text: HIDDEN_ADOPTED_TEXT, code: 0 },
      });
    },
    EACH_STEP_IS_A_PROCESS_MILLISECONDS,
  );
});
