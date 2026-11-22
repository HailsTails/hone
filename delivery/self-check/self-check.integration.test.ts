import { afterAll, assert, describe, expect, it } from "vitest";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { FileTextPort } from "../../src/application/ports/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import { createDefaultCommandRunPort, createDefaultScratchFilesPort, type ScratchFilesPort } from "../install-proof/install-proof-ports.ts";

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

const INSTALL_ROOT = absolutePathSchema.parse(createDefaultPathPort({}).join({ segments: [`${import.meta.dirname}/..`, ".."] }));

const SELF_CHECK_FILE = `${INSTALL_ROOT}/delivery/self-check/self-check.ts`;

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

const GIT_IDENTITY = ["-c", "user.name=adopter", "-c", "user.email=adopter@example.test", "-c", "commit.gpgsign=false"];

const NOT_ADOPTED = "not-adopted (3)\nauthored-class-or-this#static-members-only\nclaimed-type#unlisted-cast-site\nclaimed-type#non-null-assertions\n";

const CLASS_SYMPTOM =
  "authored-class-or-this: Authored class or this. May indicate: keeps state or settings across calls → No hidden effects; reuses behaviour from another unit or type → One reason per module; gives a value its type (declares it, or needs it narrower) → Declared, not asserted. The breach usually sits in the unit. Recipe: Closure factory. A class an outside library requires, such as an adapter extending its base class: an authorised location in that adapter. Known debt: debt. Read ../../rules/typescript/symptoms.md#authored-class-or-this\n";

const CAST_SYMPTOM =
  "claimed-type: Claimed type. May indicate: gives a value its type (declares it, or needs it narrower) → Declared, not asserted; checks a value that may be one of several outcomes → Straight-through tests; gives a value its type (declares it, or needs it narrower): in a test, a cast to build an input → Handed what it uses. The breach usually sits in the declaration: an input too wide, a generic not bounded, a missing parse. Recipes: Fix the declaration, not the value; Assert to narrow; One argument object. Correct use: an authorised location in the adapter whose outside contract forces it. Known debt: debt. Read ../../rules/typescript/symptoms.md#claimed-type\n";

const FINDINGS_ONLY_TEXT = `${NOT_ADOPTED}findings (2)
authored-class-or-this#class-keyword eslint src/kept.ts:1:7 export class Kept {} may indicate: no-hidden-effects, one-reason-per-module, declared-not-asserted
claimed-type#cast-to-any walker src/cast.ts:1:22 JSON.parse(text) as any;  may indicate: declared-not-asserted, straight-through-tests, handed-what-it-uses
assessment (1)
forfeiture elsewhere: 0 debt records not checked for forfeiture in this run
symptoms (2)
${CLASS_SYMPTOM}${CAST_SYMPTOM}verdict: fail (partial assessment)
self-check: pass, the selection, records and projection are sound; findings (2) and unrecorded (0) are reported above and not gated
`;

const ANSWERED_BY_DEBT = `answered (2)
authored-class-or-this#class-keyword eslint src/kept.ts:1:7 export class Kept {} answered by debt
claimed-type#cast-to-any walker src/cast.ts:1:22 JSON.parse(text) as any;  answered by debt
`;

const UNMEASURED_TEXT = `${NOT_ADOPTED}${ANSWERED_BY_DEBT}unmeasured (1)
forfeiture-unmeasured no-base-revision: no --base-revision was given, so debt cannot be checked for forfeiture; pass --base-revision with the branch's base, such as origin/main, or leave forfeiture to another run with "forfeiture": "elsewhere" in hone.config.json or --forfeiture elsewhere
verdict: fail
self-check: fail, gated sections hold entries: unmeasured (1)
`;

const MEASURED_TEXT = `${NOT_ADOPTED}${ANSWERED_BY_DEBT}verdict: pass
self-check: pass, the selection, records and projection are sound; findings (0) and unrecorded (0) are reported above and not gated
`;

type Printed ={ readonly text: string; readonly code: number };

const git = (request: { readonly repo: string; readonly arguments: readonly string[] }): void => {
  const run = commands.run({ command: "git", arguments: [...GIT_IDENTITY, ...request.arguments], directory: request.repo });
  assert(run.outcome === "exited", "a git step in the scratch repository ran to an exit");
  assert(run.exitCode === 0, "a git step in the scratch repository succeeded");
};

const selfCheckIn = (request: { readonly repo: string; readonly subcommand: string; readonly options: readonly string[] }): Printed => {
  const run = commands.run({
    command: "node",
    arguments: [SELF_CHECK_FILE, request.subcommand, "--repo", request.repo, ...request.options],
    directory: request.repo,
  });
  assert(run.outcome === "exited", "the self-check ran to an exit");
  return { text: run.output, code: run.exitCode };
};

const adopterRepository = (request: { readonly sources: Readonly<Record<string, string>> }): string => {
  const repo = repositoryWithSubfolder({
    repositories,
    scratch,
    fileText,
    files: { "hone.config.json": CONFIG, "eslint.config.mjs": ESLINT_CONFIG },
    subfolder: "src",
    subfolderFiles: request.sources,
  });
  git({ repo, arguments: ["init", "-q"] });
  git({ repo, arguments: ["add", "."] });
  return repo;
};

describe("self-check over a version 2 repository, run as the real script", () => {
  it(
    "reports findings without gating them, and gates debt whose forfeiture cannot be judged",
    () => {
      const repo = adopterRepository({ sources: { "kept.ts": CLASS_SOURCE, "cast.ts": CAST_SOURCE } });
      selfCheckIn({ repo, subcommand: "project", options: [] });
      git({ repo, arguments: ["add", "."] });
      git({ repo, arguments: ["commit", "-q", "-m", "commit"] });
      const findingsOnly = selfCheckIn({ repo, subcommand: "check", options: ["--forfeiture", "elsewhere"] });
      selfCheckIn({ repo, subcommand: "record-debt", options: ["--base-revision", "HEAD"] });
      selfCheckIn({ repo, subcommand: "project", options: [] });
      git({ repo, arguments: ["add", "."] });
      git({ repo, arguments: ["commit", "-q", "-m", "debt"] });
      const unmeasured = selfCheckIn({ repo, subcommand: "check", options: [] });
      const measured = selfCheckIn({ repo, subcommand: "check", options: ["--base-revision", "HEAD"] });
      expect({ findingsOnly, unmeasured, measured }).toEqual({
        findingsOnly: { text: FINDINGS_ONLY_TEXT, code: 0 },
        unmeasured: { text: UNMEASURED_TEXT, code: 1 },
        measured: { text: MEASURED_TEXT, code: 0 },
      });
    },
    EACH_STEP_IS_A_PROCESS_MILLISECONDS,
  );
});
