import { afterAll, assert, describe, expect, it } from "vitest";

import type { FileTextPort } from "../../src/application/ports/file-system/file-text-port.ts";
import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import {
  projectCommandOf,
  pruneCommandOf,
} from "../../src/infrastructure/command-line/arguments/tool-invocations.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { createDefaultFileRemovalPort } from "../../src/infrastructure/node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import {
  createDefaultCommandRunPort,
  createDefaultScratchFilesPort,
  type ScratchFilesPort,
} from "../install-proof/install-proof-ports.ts";

type ScratchRepositories = {
  readonly repositoryWith: (request: {
    readonly files: Readonly<Record<string, string>>;
  }) => AbsolutePath;
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
      const folder = absolutePathSchema.parse(
        `${request.parent.replaceAll("\\", "/")}/scratch-${globalThis.crypto.randomUUID()}`,
      );
      const directory = request.scratch.makeDirectory({ path: folder });
      if (directory.outcome !== "ok") {
        throw new Error(
          `a scratch folder could not be made at ${folder}: ${directory.error.detail}`,
        );
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
      throw new Error(
        `a scratch file could not be written at ${folder}/${name}: ${written.error.detail}`,
      );
    }
  });
  return repo;
};

const INSTALL_ROOT = absolutePathSchema.parse(
  createDefaultPathPort({}).join({ segments: [`${import.meta.dirname}/..`, ".."] }),
);

const TOOL_COMMAND_FILE = `${INSTALL_ROOT}/src/hone.ts`;

const ENTRY_URL = new URL("../../src/hone.ts", import.meta.url).href;

const EACH_STEP_IS_A_PROCESS_MILLISECONDS = 120_000;

const fileText = createDefaultFileTextPort({});

const scratch = createDefaultScratchFilesPort({});

const repositories = scratchRepositoriesUnder({
  parent: `${INSTALL_ROOT}/artefacts`,
  fileText,
  scratch,
});

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
    "claimed-type#cast-to-any": "walker",
    "claimed-type#unlisted-cast-site": "not-adopted",
    "claimed-type#non-null-assertions": "not-adopted"
  },
  "exclude": []
}
`;

const CONFIG_EXCLUDING_GENERATED = `{
  "version": 2,
  "ruleSets": {},
  "checks": {
    "authored-class-or-this#class-keyword": "eslint",
    "authored-class-or-this#static-members-only": "not-adopted",
    "claimed-type#cast-to-any": "walker",
    "claimed-type#unlisted-cast-site": "not-adopted",
    "claimed-type#non-null-assertions": "not-adopted"
  },
  "exclude": [
    "src/generated"
  ]
}
`;

const CONFIG_WITH_UNKNOWN_ENGINE = `{
  "version": 2,
  "ruleSets": {},
  "checks": {
    "authored-class-or-this#class-keyword": "eslint",
    "authored-class-or-this#static-members-only": "not-adopted",
    "claimed-type#cast-to-any": "nope",
    "claimed-type#unlisted-cast-site": "not-adopted",
    "claimed-type#non-null-assertions": "not-adopted"
  },
  "exclude": []
}
`;

const CONFIG_LEAVING_A_CHECK_UNLISTED = `{
  "version": 2,
  "ruleSets": {},
  "checks": {
    "authored-class-or-this#class-keyword": "eslint",
    "authored-class-or-this#static-members-only": "not-adopted",
    "claimed-type#cast-to-any": "walker",
    "claimed-type#non-null-assertions": "not-adopted"
  },
  "exclude": []
}
`;

const ESLINT_CONFIG = `import hone from "./hone.eslint.mjs";
export default [...hone];
`;

const PROJECTION_WITH_AN_EXTRA_LINE = `import hone from "../../src/eslint-plugin.ts";
export default [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], plugins: { hone }, rules: { "hone/authored-class-or-this#class-keyword": "error" } }];

`;

const CLASS_SOURCE = "export class Kept {}\n";

const FIXED_CLASS_SOURCE = "export const kept = 1;\n";

const CAST_SOURCE = "export const parsed = JSON.parse(text) as any;\n";

const SECOND_CAST_SOURCE = "export const added = JSON.parse(text) as any;\n";

const TOUCHED_CAST_SOURCE = "export const parsed = JSON.parse(raw) as any;\n";

const CLEAN_SOURCE = "export const clean = 1;\n";

const AUTHORISE_OPTIONS = [
  "--answers",
  "claimed-type",
  "--file",
  "src/cast.ts",
  "--case",
  "gives-a-value-its-type",
  "--owes",
  "declared-not-asserted",
  "--why",
  "Why does the audit refuse tracker ids in carve-out names?",
  "--because",
  "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
  "--evidence",
  "tools/audit/name-matcher.ts:14",
  "--why",
  "Why does the name matcher accept only lowercase slugs?",
  "--because",
  "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
  "--evidence",
  "tools/git/branch-name.ts:8",
  "--why",
  "Why was the matcher copied from the branch-name validator?",
  "--because",
  "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
  "--evidence",
  "PR #212, merged 2026-07-02",
  "--why",
  "Why did no shared slug type exist when the audit landed?",
  "--because",
  "The values package that now holds RepoPath was split out two months after the audit.",
  "--evidence",
  "packages/values/package.json:3",
  "--why",
  "Why was the values package split out after the audit?",
  "--because",
  "The split waited on the monorepo move, which left older tools on their own patterns.",
  "--evidence",
  "docs/decisions/0007-monorepo.md:21",
  "--root-cause",
  "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  "--root-evidence",
  "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  "--readback",
  "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  "--owner",
  "capture 01a0b421",
];

const NOT_ADOPTED =
  "not-adopted (3)\nauthored-class-or-this#static-members-only\nclaimed-type#unlisted-cast-site\nclaimed-type#non-null-assertions\n";

const NOT_ADOPTED_WITHOUT_THE_UNLISTED_CAST_SITE =
  "not-adopted (2)\nauthored-class-or-this#static-members-only\nclaimed-type#non-null-assertions\n";

const CLASS_FINDING =
  "authored-class-or-this#class-keyword eslint src/kept.ts:1:7 export class Kept {} symptom: authored-class-or-this (../../rules/typescript/symptoms.md#authored-class-or-this) may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted\n";

const CLASS_ANSWERED_BY_DEBT =
  "authored-class-or-this#class-keyword eslint src/kept.ts:1:7 export class Kept {} answered by debt\n";

const MAY_INDICATE =
  "symptom: claimed-type (../../rules/typescript/symptoms.md#claimed-type) may indicate: declared-not-asserted, straight-through-tests, handed-what-it-uses";

const cast = (request: {
  readonly file: string;
  readonly column: number;
  readonly source: string;
  readonly ending: string;
}): string =>
  `claimed-type#cast-to-any walker ${request.file}:1:${request.column} ${request.source}  ${request.ending}\n`;

const CAST_FINDING = cast({
  file: "src/cast.ts",
  column: 22,
  source: "JSON.parse(text) as any;",
  ending: MAY_INDICATE,
});

const CAST_ANSWERED_BY_DEBT = cast({
  file: "src/cast.ts",
  column: 22,
  source: "JSON.parse(text) as any;",
  ending: "answered by debt",
});

const CAST_ANSWERED_BY_LOCATION = cast({
  file: "src/cast.ts",
  column: 22,
  source: "JSON.parse(text) as any;",
  ending: "answered by authorised-location",
});

const TOUCHED_CAST_FINDING = cast({
  file: "src/cast.ts",
  column: 22,
  source: "JSON.parse(raw) as any;",
  ending: MAY_INDICATE,
});

const SECOND_CAST_FINDING = cast({
  file: "src/added.ts",
  column: 21,
  source: "JSON.parse(text) as any;",
  ending: MAY_INDICATE,
});

const GENERATED_CAST_FINDING = cast({
  file: "src/generated/gen.ts",
  column: 22,
  source: "JSON.parse(text) as any;",
  ending: MAY_INDICATE,
});

const CLASS_SYMPTOM =
  "authored-class-or-this: Authored class or this. May indicate: keeps state or settings across calls → No hidden effects; reuses behaviour from another unit or type → One reason per module; gives a value its type (declares it, or needs it narrower) → Declared, not asserted. The breach usually sits in the unit. Recipe: Closure factory. Read ../../rules/typescript/symptoms.md#authored-class-or-this\n";

const CAST_SYMPTOM =
  "claimed-type: Claimed type. May indicate: gives a value its type (declares it, or needs it narrower) → Declared, not asserted; checks a value that may be one of several outcomes → Straight-through tests; gives a value its type (declares it, or needs it narrower): in a test, a cast to build an input → Handed what it uses. The breach usually sits in the declaration: an input too wide, a generic not bounded, a missing parse. Recipes: Fix the declaration, not the value; Assert to narrow; One argument object. Read ../../rules/typescript/symptoms.md#claimed-type\n";

type Printed = { readonly text: string; readonly code: number };

const PATH = createDefaultPathPort({});

const projectCommandIn = (request: { readonly repo: string }): string => {
  const command = projectCommandOf({
    path: PATH,
    moduleUrl: ENTRY_URL,
    repoRoot: absolutePathSchema.parse(request.repo),
  });
  assert(command.outcome === "ok", "the project command is made");
  return command.value;
};

const projectNextLineIn = (request: { readonly repo: string }): string =>
  `run ${projectCommandIn(request)} to put the recorded debt into effect\n`;

const pruneCommandAtHeadIn = (request: { readonly repo: string }): string => {
  const command = pruneCommandOf({
    path: PATH,
    moduleUrl: ENTRY_URL,
    repoRoot: absolutePathSchema.parse(request.repo),
    baseRevision: "HEAD",
    forfeiture: undefined,
  });
  assert(command.outcome === "ok", "the prune command is made");
  return command.value;
};

const runCommandIn = (request: {
  readonly repo: string;
  readonly subcommand: string;
  readonly options: readonly string[];
}): Printed => {
  const run = commands.run({
    command: "node",
    arguments: [TOOL_COMMAND_FILE, request.subcommand, "--repo", request.repo, ...request.options],
    directory: request.repo,
  });
  assert(run.outcome === "exited", "the tool command ran to an exit");
  return { text: run.output, code: run.exitCode };
};

const GIT_IDENTITY = [
  "-c",
  "user.name=adopter",
  "-c",
  "user.email=adopter@example.test",
  "-c",
  "commit.gpgsign=false",
];

const git = (request: { readonly repo: string; readonly arguments: readonly string[] }): void => {
  const run = commands.run({
    command: "git",
    arguments: [...GIT_IDENTITY, ...request.arguments],
    directory: request.repo,
  });
  assert(run.outcome === "exited", "a git step in the scratch repository ran to an exit");
  assert(run.exitCode === 0, "a git step in the scratch repository succeeded");
};

const trackEverything = (request: { readonly repo: string }): void => {
  git({ repo: request.repo, arguments: ["add", "."] });
};

const commitEverything = (request: { readonly repo: string }): void => {
  trackEverything(request);
  git({ repo: request.repo, arguments: ["commit", "-m", "commit"] });
};

const writeIn = (request: {
  readonly repo: string;
  readonly file: string;
  readonly text: string;
}): void => {
  const written = fileText.write({ path: `${request.repo}/${request.file}`, text: request.text });
  assert(written.outcome === "ok", "the scratch file is written");
};

const adopterRepository = (request: {
  readonly sources: Readonly<Record<string, string>>;
}): string => {
  const repo = repositoryWithSubfolder({
    repositories,
    scratch,
    fileText,
    files: { "hone.config.json": CONFIG, "eslint.config.mjs": ESLINT_CONFIG },
    subfolder: "src",
    subfolderFiles: request.sources,
  });
  git({ repo, arguments: ["init", "-q"] });
  trackEverything({ repo });
  return repo;
};

const adopterRepositoryWithGeneratedFolder = (): string => {
  const repo = adopterRepository({ sources: { "clean.ts": CLEAN_SOURCE } });
  const made = scratch.makeDirectory({ path: `${repo}/src/generated` });
  assert(made.outcome === "ok", "the generated folder is made");
  writeIn({ repo, file: "src/generated/gen.ts", text: CAST_SOURCE });
  trackEverything({ repo });
  return repo;
};

const PROJECTION_WRITTEN: Printed = {
  text: "hone.eslint.mjs written\nhone.eslint.d.mts written\n",
  code: 0,
};

const PROJECTION_REWRITTEN: Printed = {
  text: "hone.eslint.mjs written\nhone.eslint.d.mts unchanged\n",
  code: 0,
};

const PROJECTION_UNCHANGED: Printed = {
  text: "hone.eslint.mjs unchanged\nhone.eslint.d.mts unchanged\n",
  code: 0,
};

const forfeitedLine = (request: {
  readonly repo: string;
  readonly check: string;
  readonly file: string;
}): string =>
  `forfeited (1)\n${request.check} debt ${request.file}; this change touched its file, so it no longer answers: fix what it held, then run ${pruneCommandAtHeadIn({ repo: request.repo })} to remove it\n`;

describe("a version 2 adopter's repository, from the first project to a clean check, run as the real tool command", () => {
  it(
    "projects, finds each violation, answers both by debt, replaces one debt with an authorised location, prunes what that paid, and passes once the other is fixed",
    () => {
      const repo = adopterRepository({
        sources: { "kept.ts": CLASS_SOURCE, "cast.ts": CAST_SOURCE },
      });
      const projected = runCommandIn({ repo, subcommand: "project", options: [] });
      const projectedAgain = runCommandIn({ repo, subcommand: "project", options: [] });
      const checked = runCommandIn({ repo, subcommand: "check", options: [] });
      commitEverything({ repo });
      const recorded = runCommandIn({
        repo,
        subcommand: "record-debt",
        options: ["--base-revision", "HEAD"],
      });
      const projectedWithDebt = runCommandIn({ repo, subcommand: "project", options: [] });
      trackEverything({ repo });
      const answeredByDebt = runCommandIn({
        repo,
        subcommand: "check",
        options: ["--base-revision", "HEAD"],
      });
      const authorised = runCommandIn({
        repo,
        subcommand: "authorise",
        options: AUTHORISE_OPTIONS,
      });
      trackEverything({ repo });
      const answeredByLocation = runCommandIn({
        repo,
        subcommand: "check",
        options: ["--base-revision", "HEAD"],
      });
      const pruned = runCommandIn({
        repo,
        subcommand: "prune-debt",
        options: ["--base-revision", "HEAD"],
      });
      writeIn({ repo, file: "src/kept.ts", text: FIXED_CLASS_SOURCE });
      trackEverything({ repo });
      const forfeited = runCommandIn({
        repo,
        subcommand: "check",
        options: ["--base-revision", "HEAD"],
      });
      const prunedForfeited = runCommandIn({
        repo,
        subcommand: "prune-debt",
        options: ["--base-revision", "HEAD"],
      });
      const projectedWithoutDebt = runCommandIn({ repo, subcommand: "project", options: [] });
      trackEverything({ repo });
      const clean = runCommandIn({
        repo,
        subcommand: "check",
        options: ["--base-revision", "HEAD"],
      });
      expect({
        projected,
        projectedAgain,
        checked,
        recorded,
        projectedWithDebt,
        answeredByDebt,
        authorised,
        answeredByLocation,
        pruned,
        forfeited,
        prunedForfeited,
        projectedWithoutDebt,
        clean,
      }).toEqual({
        projected: PROJECTION_WRITTEN,
        projectedAgain: PROJECTION_UNCHANGED,
        checked: {
          text: `${NOT_ADOPTED}findings (2)\n${CLASS_FINDING}${CAST_FINDING}symptoms (2)\n${CLASS_SYMPTOM}${CAST_SYMPTOM}verdict: fail\n`,
          code: 1,
        },
        recorded: {
          text: `claimed-type#cast-to-any recorded src/cast.ts\nauthored-class-or-this#class-keyword recorded src/kept.ts\n${projectNextLineIn({ repo })}`,
          code: 0,
        },
        projectedWithDebt: PROJECTION_REWRITTEN,
        answeredByDebt: {
          text: `${NOT_ADOPTED}answered (2)\n${CLASS_ANSWERED_BY_DEBT}${CAST_ANSWERED_BY_DEBT}verdict: pass\n`,
          code: 0,
        },
        authorised: { text: "claimed-type authorised src/cast.ts\n", code: 0 },
        answeredByLocation: {
          text: `${NOT_ADOPTED}answered (2)\n${CLASS_ANSWERED_BY_DEBT}${CAST_ANSWERED_BY_LOCATION}paid (1)\nclaimed-type#cast-to-any debt src/cast.ts answered by authorised-location; run ${pruneCommandAtHeadIn({ repo })} to remove the paid debt\nverdict: pass\n`,
          code: 0,
        },
        pruned: { text: "claimed-type#cast-to-any removed src/cast.ts: paid\n", code: 0 },
        forfeited: {
          text: `${NOT_ADOPTED}answered (1)\n${CAST_ANSWERED_BY_LOCATION}${forfeitedLine({ repo, check: "authored-class-or-this#class-keyword", file: "src/kept.ts" })}verdict: fail\n`,
          code: 1,
        },
        prunedForfeited: {
          text: "authored-class-or-this#class-keyword removed src/kept.ts: forfeited\n",
          code: 0,
        },
        projectedWithoutDebt: PROJECTION_REWRITTEN,
        clean: {
          text: `${NOT_ADOPTED}answered (1)\n${CAST_ANSWERED_BY_LOCATION}verdict: pass\n`,
          code: 0,
        },
      });
    },
    EACH_STEP_IS_A_PROCESS_MILLISECONDS,
  );
});

const FORFEITURE_UNMEASURED =
  'unmeasured (1)\nforfeiture-unmeasured no-base-revision: no --base-revision was given, so debt cannot be checked for forfeiture; pass --base-revision with the branch\'s base, such as origin/main, or leave forfeiture to another run with "forfeiture": "elsewhere" in hone.config.json or --forfeiture elsewhere\n';

describe("a version 2 adopter's repository judged against a base revision, run as the real tool command", () => {
  it(
    "cannot judge debt with no base, passes with the base when nothing changed, reports a new violation, and forfeits debt on a file the change touched",
    () => {
      const repo = adopterRepository({
        sources: { "kept.ts": FIXED_CLASS_SOURCE, "cast.ts": CAST_SOURCE },
      });
      runCommandIn({ repo, subcommand: "project", options: [] });
      commitEverything({ repo });
      const recorded = runCommandIn({
        repo,
        subcommand: "record-debt",
        options: ["--base-revision", "HEAD"],
      });
      commitEverything({ repo });
      const withoutBase = runCommandIn({ repo, subcommand: "check", options: [] });
      const unchanged = runCommandIn({
        repo,
        subcommand: "check",
        options: ["--base-revision", "HEAD"],
      });
      writeIn({ repo, file: "src/added.ts", text: SECOND_CAST_SOURCE });
      trackEverything({ repo });
      const added = runCommandIn({
        repo,
        subcommand: "check",
        options: ["--base-revision", "HEAD"],
      });
      writeIn({ repo, file: "src/cast.ts", text: TOUCHED_CAST_SOURCE });
      const touched = runCommandIn({
        repo,
        subcommand: "check",
        options: ["--base-revision", "HEAD"],
      });
      expect({ recorded, withoutBase, unchanged, added, touched }).toEqual({
        recorded: {
          text: `claimed-type#cast-to-any recorded src/cast.ts\n${projectNextLineIn({ repo })}`,
          code: 0,
        },
        withoutBase: {
          text: `${NOT_ADOPTED}answered (1)\n${CAST_ANSWERED_BY_DEBT}${FORFEITURE_UNMEASURED}verdict: fail\n`,
          code: 1,
        },
        unchanged: {
          text: `${NOT_ADOPTED}answered (1)\n${CAST_ANSWERED_BY_DEBT}verdict: pass\n`,
          code: 0,
        },
        added: {
          text: `${NOT_ADOPTED}findings (1)\n${SECOND_CAST_FINDING}answered (1)\n${CAST_ANSWERED_BY_DEBT}symptoms (1)\n${CAST_SYMPTOM}verdict: fail\n`,
          code: 1,
        },
        touched: {
          text: `${NOT_ADOPTED}findings (2)\n${SECOND_CAST_FINDING}${TOUCHED_CAST_FINDING}${forfeitedLine({ repo, check: "claimed-type#cast-to-any", file: "src/cast.ts" })}symptoms (1)\n${CAST_SYMPTOM}verdict: fail\n`,
          code: 1,
        },
      });
    },
    EACH_STEP_IS_A_PROCESS_MILLISECONDS,
  );
});

const outOfDateProjection = (request: { readonly repo: string }): string =>
  `projection-problems (1)\neslint out-of-date: hone.eslint.mjs differs from what hone project writes now; run ${projectCommandIn({ repo: request.repo })} and commit every file it writes\n`;

const missingProjection = (request: { readonly repo: string }): string =>
  `unmeasured (1)\nengine-not-run eslint missing: hone.eslint.mjs is not written; run ${projectCommandIn({ repo: request.repo })} and commit every file it writes\n`;

describe("the settings a version 2 adopter edits, run as the real tool command", () => {
  it(
    "drops an excluded folder from the check, and prints the folder as excluded",
    () => {
      const repo = adopterRepositoryWithGeneratedFolder();
      runCommandIn({ repo, subcommand: "project", options: [] });
      const before = runCommandIn({ repo, subcommand: "check", options: [] });
      writeIn({ repo, file: "hone.config.json", text: CONFIG_EXCLUDING_GENERATED });
      const after = runCommandIn({ repo, subcommand: "check", options: [] });
      expect({ before, after }).toEqual({
        before: {
          text: `${NOT_ADOPTED}findings (1)\n${GENERATED_CAST_FINDING}symptoms (1)\n${CAST_SYMPTOM}verdict: fail\n`,
          code: 1,
        },
        after: { text: `excluded (1)\nsrc/generated\n${NOT_ADOPTED}verdict: pass\n`, code: 0 },
      });
    },
    EACH_STEP_IS_A_PROCESS_MILLISECONDS,
  );

  it(
    "refuses an engine a check does not run on, naming the check, and exits 2 with no verdict",
    () => {
      const repo = adopterRepositoryWithGeneratedFolder();
      writeIn({ repo, file: "hone.config.json", text: CONFIG_WITH_UNKNOWN_ENGINE });
      expect(runCommandIn({ repo, subcommand: "check", options: [] })).toEqual({
        text: "load failure: engine-not-allowed claimed-type#cast-to-any nope: it runs on walker; list it with one of those\n",
        code: 2,
      });
    },
    EACH_STEP_IS_A_PROCESS_MILLISECONDS,
  );

  it(
    "passes with a check of a selected symptom that is neither listed nor marked, offering it as available",
    () => {
      const repo = adopterRepository({ sources: { "clean.ts": CLEAN_SOURCE } });
      runCommandIn({ repo, subcommand: "project", options: [] });
      writeIn({ repo, file: "hone.config.json", text: CONFIG_LEAVING_A_CHECK_UNLISTED });
      expect(runCommandIn({ repo, subcommand: "check", options: [] })).toEqual({
        text: `${NOT_ADOPTED_WITHOUT_THE_UNLISTED_CAST_SITE}available (1)\nclaimed-type#unlisted-cast-site\nverdict: pass\n`,
        code: 0,
      });
    },
    EACH_STEP_IS_A_PROCESS_MILLISECONDS,
  );

  it(
    "says a projection that differs from what project writes is out of date, and one that is not written is missing, each with the command that fixes it, with nothing else wrong",
    () => {
      const repo = adopterRepository({ sources: { "clean.ts": CLEAN_SOURCE } });
      runCommandIn({ repo, subcommand: "project", options: [] });
      writeIn({ repo, file: "hone.eslint.mjs", text: PROJECTION_WITH_AN_EXTRA_LINE });
      const outOfDate = runCommandIn({ repo, subcommand: "check", options: [] });
      const removed = createDefaultFileRemovalPort({}).remove({ path: `${repo}/hone.eslint.mjs` });
      assert(removed.outcome === "ok", "the projection is removed");
      const missing = runCommandIn({ repo, subcommand: "check", options: [] });
      expect({ outOfDate, missing }).toEqual({
        outOfDate: {
          text: `${NOT_ADOPTED}${outOfDateProjection({ repo })}verdict: fail\n`,
          code: 1,
        },
        missing: { text: `${NOT_ADOPTED}${missingProjection({ repo })}verdict: fail\n`, code: 1 },
      });
    },
    EACH_STEP_IS_A_PROCESS_MILLISECONDS,
  );
});
