import type { FileTextPort } from "../src/infrastructure/node/file-system/file-system-port.ts";
import type { PathPort } from "../src/infrastructure/node/path-port.ts";
import type { Recipe } from "../src/domain/language-layer/symptom-catalogue.ts";
import type { ReadonlyJsonValue } from "../src/domain/settings/json-values/json-value.ts";
import type { Result } from "../src/domain/result.ts";
import type { CommandRunPort, ScratchFilesPort } from "../delivery/install-proof/install-proof-ports.ts";

export type ScratchRecordsFile = { readonly folder: string; readonly name: string; readonly records: readonly ReadonlyJsonValue[] };

export type RecordsRepository = { readonly base: readonly ScratchRecordsFile[]; readonly working: readonly ScratchRecordsFile[] };

export type ScratchPorts = {
  readonly scratch: Pick<ScratchFilesPort, "createTemporaryDirectory" | "makeDirectory">;
  readonly files: Pick<FileTextPort, "write">;
  readonly commands: CommandRunPort;
  readonly path: Pick<PathPort, "join">;
};

export type ScratchFailure = { readonly kind: "scratch-failed"; readonly step: string; readonly detail: string };

type Step = Result<null, ScratchFailure>;

const SCRATCH_PREFIX = "hone-records-";

const RECORDS_VERSION = 2;

const JSON_INDENT = 2;

const GIT_IDENTITY: readonly string[] = ["-c", "user.name=hone-records", "-c", "user.email=hone-records@invalid", "-c", "commit.gpgsign=false"];

const DONE: Step = { outcome: "ok", value: null };

const failedAt = (request: { readonly step: string; readonly detail: string }): Result<never, ScratchFailure> => ({
  outcome: "failed",
  error: { kind: "scratch-failed", ...request },
});

const gitRun = (request: { readonly ports: ScratchPorts; readonly root: string; readonly gitArguments: readonly string[] }): Step => {
  const step = `git ${request.gitArguments.join(" ")}`;
  const run = request.ports.commands.run({ command: "git", arguments: request.gitArguments, directory: request.root });
  if (run.outcome === "not-exited") {
    return failedAt({ step, detail: run.detail });
  }
  return run.exitCode === 0 ? DONE : failedAt({ step, detail: run.output });
};

const documentTextOf = (request: { readonly file: ScratchRecordsFile }): string =>
  `${JSON.stringify({ version: RECORDS_VERSION, records: request.file.records }, null, JSON_INDENT)}\n`;

const writtenFile = (request: { readonly ports: ScratchPorts; readonly root: string; readonly file: ScratchRecordsFile }): Step => {
  const folder = request.ports.path.join({ segments: [request.root, request.file.folder] });
  const made = request.ports.scratch.makeDirectory({ path: folder });
  if (made.outcome === "failed") {
    return failedAt({ step: `make ${folder}`, detail: made.error.detail });
  }
  const path = request.ports.path.join({ segments: [request.root, request.file.folder, request.file.name] });
  const written = request.ports.files.write({ path, text: documentTextOf(request) });
  return written.outcome === "failed" ? failedAt({ step: `write ${path}`, detail: written.error.detail }) : DONE;
};

const writtenAll = (request: { readonly ports: ScratchPorts; readonly root: string; readonly files: readonly ScratchRecordsFile[] }): Step =>
  request.files.reduce<Step>((sofar, file) => (sofar.outcome === "failed" ? sofar : writtenFile({ ports: request.ports, root: request.root, file })), DONE);

export const recipeReasonIn = (request: { readonly recipes: readonly Recipe[]; readonly recipe: string }): Result<string, ScratchFailure> => {
  const found = request.recipes.find((candidate) => candidate.name === request.recipe);
  return found === undefined
    ? { outcome: "failed", error: { kind: "scratch-failed", step: `find the recipe ${request.recipe}`, detail: "the catalogue holds no such recipe" } }
    : { outcome: "ok", value: found.reason.text };
};

export const recordsRepositoryIn =(request: { readonly ports: ScratchPorts; readonly repository: RecordsRepository }): Result<string, ScratchFailure> => {
  const { ports, repository } = request;
  const made = ports.scratch.createTemporaryDirectory({ prefix: SCRATCH_PREFIX });
  if (made.outcome === "failed") {
    return failedAt({ step: "make the temporary directory", detail: made.error.detail });
  }
  const root = made.value;
  const steps: readonly (() => Step)[] = [
    () => gitRun({ ports, root, gitArguments: ["init", "-q"] }),
    () => writtenAll({ ports, root, files: repository.base }),
    () => gitRun({ ports, root, gitArguments: ["add", "-A"] }),
    () => gitRun({ ports, root, gitArguments: [...GIT_IDENTITY, "commit", "-q", "-m", "base"] }),
    () => writtenAll({ ports, root, files: repository.working }),
  ];
  const settled = steps.reduce<Step>((sofar, step) => (sofar.outcome === "failed" ? sofar : step()), DONE);
  return settled.outcome === "failed" ? failedAt(settled.error) : { outcome: "ok", value: root };
};
