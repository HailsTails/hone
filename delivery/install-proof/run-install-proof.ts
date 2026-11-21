import type { FileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import type { PathPort } from "../../src/infrastructure/node/path-port.ts";
import type { ProcessPort } from "../../src/infrastructure/node/process/process-port.ts";
import type { Result } from "../../src/domain/result.ts";
import {
  type CommandScript,
  consumerSettingsOf,
  installedVersionOf,
  judgedStep,
  minimumReleaseAgeOf,
  packageManagerPinOf,
  packagedScriptsOf,
  packagedConsumerManifest,
  type ProofAction,
  type ProofCase,
  type StepRun,
  toolchainPinsOf,
} from "./install-proof-plan.ts";
import type { CommandRunPort, ProofCommand, ScratchFilesPort } from "./install-proof-ports.ts";
import type { TarballPackerPort } from "../packaging/packing/package-commands.ts";
import { caretFitOf, caretRangeOf } from "../packaging/published-manifest/caret-range.ts";
import { type DependencyRanges, dependencyRangesOf } from "../packaging/published-manifest/published-manifest.ts";
import { packageFileStemOf, TOOL_IDENTITY } from "../../src/domain/rule-set/tool-identity.ts";

export type InstallProofRequest = {
  readonly process: ProcessPort;
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly scratch: ScratchFilesPort;
  readonly commands: CommandRunPort;
  readonly packer: TarballPackerPort;
  readonly moduleUrl: string;
  readonly proofCases: readonly ProofCase[];
};

type Step = () => Result<null, string>;

type ProofContext = {
  readonly process: ProcessPort;
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly scratch: ScratchFilesPort;
  readonly commands: CommandRunPort;
  readonly packageRoot: string;
};

const SUCCEEDED: Result<null, string> = { outcome: "ok", value: null };
const IGNORED_INSTALLS = "node_modules/\n";
const TEMPORARY_PREFIX = `${packageFileStemOf({ packageName: TOOL_IDENTITY.packageName })}-install-proof-`;
const GIT_IDENTITY = ["-c", "user.name=proof", "-c", "user.email=proof@invalid", "-c", "commit.gpgsign=false"];
const PNPM_INSTALL = ["install", "--ignore-scripts", "--prefer-offline", "--no-frozen-lockfile"];
const NODE_MODULES = "node_modules";
const LINKED_INSTALL = `${NODE_MODULES}/${TOOL_IDENTITY.packageName}`;
const PASS_LINE = "install proof: pass\n";
const PNPM_RUN_SILENT = ["run", "--silent"];
const SOURCE_MODULE_SUFFIX = ".ts";
const DECLARATION_SUFFIX = ".d.ts";
const INSTALLED_TYPESCRIPT_COMPILER = "node_modules/typescript/bin/tsc";
const TYPECHECK_ONLY = ["--noEmit", "-p"];
const PLATFORM_LINE_END = "\r\n";
const PNPM_SETTINGS = ".npmrc";
const LINT_SCRIPT = "lint";
const END_OF_OPTIONS = "--";
const PACKAGE_MANIFEST = "package.json";
const PACKAGE_NAME_SEPARATOR = "/";
const inOrder = (request: { readonly steps: readonly Step[] }): Result<null, string> =>
  request.steps.reduce<Result<null, string>>((sofar, step) => (sofar.outcome === "failed" ? sofar : step()), SUCCEEDED);

const labelled = <T>(request: {
  readonly label: string;
  readonly result: Result<T, { readonly detail: string }>;
}): Result<T, string> =>
  request.result.outcome === "failed"
    ? { outcome: "failed", error: `FAIL: ${request.label}: ${request.result.error.detail}` }
    : request.result;

const emptied = (request: { readonly result: Result<unknown, string> }): Result<null, string> =>
  request.result.outcome === "failed" ? request.result : SUCCEEDED;

const succeededRun = (request: { readonly label: string; readonly run: StepRun }): Result<null, string> => {
  if (request.run.outcome === "not-exited") {
    return { outcome: "failed", error: `FAIL: ${request.label}: did not exit: ${request.run.detail}` };
  }
  return request.run.exitCode === 0
    ? SUCCEEDED
    : { outcome: "failed", error: `FAIL: ${request.label}: exit ${request.run.exitCode}\n${request.run.output}` };
};

const ranCommand = (request: {
  readonly context: ProofContext;
  readonly label: string;
  readonly command: ProofCommand;
  readonly arguments: readonly string[];
  readonly directory: string;
}): Result<null, string> =>
  succeededRun({
    label: request.label,
    run: request.context.commands.run({
      command: request.command,
      arguments: request.arguments,
      directory: request.directory,
    }),
  });

const git = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly consumer: string;
  readonly arguments: readonly string[];
}): Result<null, string> =>
  ranCommand({
    context: request.context,
    label: `git ${request.arguments.join(" ")} in ${request.consumer}`,
    command: "git",
    arguments: [...GIT_IDENTITY, ...request.arguments],
    directory: request.repo,
  });

const commitAll = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly consumer: string;
  readonly message: string;
}): Result<null, string> =>
  inOrder({
    steps: [
      () => git({ ...request, arguments: ["add", "-A"] }),
      () => git({ ...request, arguments: ["commit", "-q", "-m", request.message] }),
    ],
  });

const commandRun = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly script: CommandScript;
  readonly arguments: readonly string[];
}): StepRun =>
  request.context.commands.run({
    command: "pnpm",
    arguments: [...PNPM_RUN_SILENT, packagedScriptsOf({ identity: TOOL_IDENTITY })[request.script], ...request.arguments],
    directory: request.repo,
  });

const installedCommand = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly label: string;
  readonly script: CommandScript;
  readonly arguments: readonly string[];
  readonly action: Extract<ProofAction, { readonly kind: "check" | "project" }>;
}): Result<null, string> => {
  const judged = judgedStep({ label: request.label, expectation: request.action.expectation, run: commandRun(request) });
  if (judged.outcome === "failed") {
    return judged;
  }
  request.context.process.writeOut({ text: `${judged.value}\n` });
  return SUCCEEDED;
};

const withLineFeeds = (request: { readonly run: StepRun }): StepRun =>
  request.run.outcome === "exited"
    ? { ...request.run, output: request.run.output.replaceAll(PLATFORM_LINE_END, "\n") }
    : request.run;

const typeCheckedProject = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly consumer: string;
  readonly action: Extract<ProofAction, { readonly kind: "typecheck" }>;
}): Result<null, string> => {
  const judged = judgedStep({
    label: `${request.consumer} tsc -p ${request.action.project}`,
    expectation: request.action.expectation,
    run: withLineFeeds({
      run: request.context.commands.run({
        command: "node",
        arguments: [INSTALLED_TYPESCRIPT_COMPILER, ...TYPECHECK_ONLY, request.action.project],
        directory: request.repo,
      }),
    }),
  });
  if (judged.outcome === "failed") {
    return judged;
  }
  request.context.process.writeOut({ text: `${judged.value}\n` });
  return SUCCEEDED;
};

const packageLint = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly consumer: string;
  readonly action: Extract<ProofAction, { readonly kind: "lint" }>;
}): Result<null, string> => {
  const judged = judgedStep({
    label: `${request.consumer} lint in ${request.action.directory}`,
    expectation: request.action.expectation,
    run: withLineFeeds({
      run: request.context.commands.run({
        command: "pnpm",
        arguments: [...PNPM_RUN_SILENT, LINT_SCRIPT],
        directory: request.context.path.join({ segments: [request.repo, request.action.directory] }),
      }),
    }),
  });
  if (judged.outcome === "failed") {
    return judged;
  }
  request.context.process.writeOut({ text: `${judged.value}\n` });
  return SUCCEEDED;
};

const consumerScript = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly consumer: string;
  readonly action: Extract<ProofAction, { readonly kind: "run" }>;
}): Result<null, string> => {
  const judged = judgedStep({
    label: `${request.consumer} node ${request.action.script}`,
    expectation: request.action.expectation,
    run: withLineFeeds({
      run: request.context.commands.run({ command: "node", arguments: [request.action.script], directory: request.repo }),
    }),
  });
  if (judged.outcome === "failed") {
    return judged;
  }
  request.context.process.writeOut({ text: `${judged.value}\n` });
  return SUCCEEDED;
};

const readExactly = (request: {
  readonly context: ProofContext;
  readonly label: string;
  readonly path: string;
  readonly text: string;
}): Result<null, string> => {
  const read = labelled({ label: request.label, result: request.context.fileText.read({ path: request.path }) });
  if (read.outcome === "failed") {
    return read;
  }
  if (read.value !== request.text) {
    return {
      outcome: "failed",
      error: `FAIL: ${request.label}: expected ${JSON.stringify(request.text)}, but it reads ${JSON.stringify(read.value)}`,
    };
  }
  request.context.process.writeOut({ text: `ok: ${request.label} reads exactly as expected\n` });
  return SUCCEEDED;
};

const performedAction = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly consumer: string;
  readonly action: ProofAction;
}): Result<null, string> => {
  const action = request.action;
  switch (action.kind) {
    case "check":
      return installedCommand({
        ...request,
        label: `${request.consumer} check`,
        script: "check",
        arguments: [END_OF_OPTIONS, "--base-revision", "HEAD"],
        action,
      });
    case "project":
      return installedCommand({ ...request, label: `${request.consumer} project`, script: "project", arguments: [], action });
    case "commit":
      return commitAll({ context: request.context, repo: request.repo, consumer: request.consumer, message: action.message });
    case "read":
      return readExactly({
        context: request.context,
        label: `${request.consumer} ${action.path}`,
        path: request.context.path.join({ segments: [request.repo, action.path] }),
        text: action.text,
      });
    case "typecheck":
      return typeCheckedProject({ context: request.context, repo: request.repo, consumer: request.consumer, action });
    case "lint":
      return packageLint({ context: request.context, repo: request.repo, consumer: request.consumer, action });
    case "run":
      return consumerScript({ context: request.context, repo: request.repo, consumer: request.consumer, action });
  }
};

const writtenFile = (request: {
  readonly context: ProofContext;
  readonly label: string;
  readonly path: string;
  readonly text: string;
}): Result<null, string> =>
  emptied({
    result: labelled({ label: request.label, result: request.context.fileText.write({ path: request.path, text: request.text }) }),
  });

type ConsumerFile = { readonly name: string; readonly text: string };

type InstallSettings = { readonly packageManager: string; readonly minimumReleaseAge: number; readonly dependencyRanges: DependencyRanges };

const consumerFiles = (request: {
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly settings: InstallSettings;
  readonly proofCase: ProofCase;
}): readonly ConsumerFile[] => [
  {
    name: "package.json",
    text: packagedConsumerManifest({
      identity: TOOL_IDENTITY,
      devDependencies: request.devDependencies,
      packageManager: request.settings.packageManager,
    }),
  },
  { name: ".gitignore", text: IGNORED_INSTALLS },
  {
    name: PNPM_SETTINGS,
    text: consumerSettingsOf({ minimumReleaseAge: request.settings.minimumReleaseAge, typeStripping: request.proofCase.typeStripping }),
  },
];

const preparedConsumer = (request: {
  readonly context: ProofContext;
  readonly fixture: string;
  readonly repo: string;
  readonly files: readonly ConsumerFile[];
}): Result<null, string> => {
  const label = `prepare the consumer ${request.repo}`;
  return inOrder({
    steps: [
      () =>
        labelled({
          label,
          result: request.context.scratch.copyTree({ from: request.fixture, to: request.repo, disposition: () => "kept" }),
        }),
      ...request.files.map(
        (file): Step =>
          () =>
            writtenFile({
              context: request.context,
              label,
              path: request.context.path.join({ segments: [request.repo, file.name] }),
              text: file.text,
            }),
      ),
    ],
  });
};

type ProofInputs = {
  readonly context: ProofContext;
  readonly temporaryRoot: string;
  readonly packageManifest: string;
  readonly settings: InstallSettings;
  readonly tarball: string;
};

type CaseRequest = ProofInputs & { readonly proofCase: ProofCase };

const consumerRepo = (request: CaseRequest): string =>
  request.context.path.join({ segments: [request.temporaryRoot, request.proofCase.consumer] });

const consumerFixture = (request: CaseRequest): string =>
  request.context.path.join({
    segments: [request.context.packageRoot, "delivery", "install-proof", "consumer-proof", request.proofCase.fixture],
  });
const packageShipsNoSource = (request: {
  readonly context: ProofContext;
  readonly consumer: string;
  readonly installedPackage: string;
}): Result<null, string> => {
  const label = `${request.consumer} installed package holds no TypeScript source to strip`;
  const listed = labelled({ label, result: request.context.scratch.listTree({ path: request.installedPackage }) });
  if (listed.outcome === "failed") {
    return listed;
  }
  const sources = listed.value.filter(
    (entry) => entry.entryKind === "file" && entry.name.endsWith(SOURCE_MODULE_SUFFIX) && !entry.name.endsWith(DECLARATION_SUFFIX),
  );
  const modules = listed.value.filter((entry) => entry.entryKind === "file" && entry.name.endsWith(".js"));
  if (sources.length > 0 || modules.length === 0) {
    return {
      outcome: "failed",
      error: `FAIL: ${label}: found ${sources.length} .ts and ${modules.length} .js files under ${request.installedPackage}`,
    };
  }
  request.context.process.writeOut({ text: `ok: ${label}\n` });
  return SUCCEEDED;
};

const pathFrom = (request: { readonly context: ProofContext; readonly repo: string; readonly path: string }): Result<string, string> => {
  const placed = request.context.path.relative({ from: request.repo, to: request.path });
  return placed.relation === "within-root"
    ? { outcome: "ok", value: placed.path }
    : { outcome: "failed", error: `${request.path} shares no root with ${request.repo}` };
};

const PARENT_FOLDER = "..";

const containedPathOf = (request: { readonly context: ProofContext; readonly repo: string; readonly path: string }): Result<string, string> => {
  const placed = pathFrom(request);
  return placed.outcome === "ok" && placed.value !== PARENT_FOLDER && !placed.value.startsWith(`${PARENT_FOLDER}/`)
    ? placed
    : { outcome: "failed", error: `${request.path} lies outside ${request.repo}` };
};

const consumerDependenciesOf = (request: CaseRequest & { readonly repo: string }): Result<Readonly<Record<string, string>>, string> => {
  const pins = toolchainPinsOf({ developmentManifest: request.packageManifest, toolchain: request.proofCase.toolchain });
  if (pins.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: package.json: ${pins.error.detail}` };
  }
  const tarball = pathFrom({ context: request.context, repo: request.repo, path: request.tarball });
  return tarball.outcome === "failed"
    ? { outcome: "failed", error: `FAIL: locate the packed tarball from ${request.proofCase.consumer}: ${tarball.error}` }
    : { outcome: "ok", value: { ...pins.value, [TOOL_IDENTITY.packageName]: `file:${tarball.value}` } };
};

const installedLocationOf = (request: { readonly context: ProofContext; readonly repo: string; readonly consumer: string }): Result<string, string> => {
  const label = `${request.consumer} runs the package from where pnpm put it`;
  const realRepo = labelled({ label, result: request.context.scratch.realPathOf({ path: request.repo }) });
  if (realRepo.outcome === "failed") {
    return realRepo;
  }
  const real = labelled({ label, result: request.context.scratch.realPathOf({ path: request.context.path.join({ segments: [request.repo, LINKED_INSTALL] }) }) });
  if (real.outcome === "failed") {
    return real;
  }
  const installed = containedPathOf({ context: request.context, repo: realRepo.value, path: real.value });
  if (installed.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: ${label}: ${installed.error}` };
  }
  request.context.process.writeOut({ text: `ok: ${request.consumer} runs the package from ${installed.value}\n` });
  return installed;
};

const folderAbove = (request: { readonly context: ProofContext; readonly folder: string; readonly levels: number }): string =>
  request.levels === 0
    ? request.folder
    : folderAbove({ ...request, folder: request.context.path.directoryOf({ path: request.folder }), levels: request.levels - 1 });

const installedDependencyOf = (request: {
  readonly context: ProofContext;
  readonly besideInstall: string;
  readonly name: string;
  readonly range: string;
}): Result<string, string> => {
  const folder = request.context.path.join({ segments: [request.besideInstall, ...request.name.split(PACKAGE_NAME_SEPARATOR)] });
  const manifest = request.context.fileText.read({ path: request.context.path.join({ segments: [folder, PACKAGE_MANIFEST] }) });
  if (manifest.outcome === "failed") {
    return { outcome: "failed", error: `${request.name} is not installed at ${folder}: ${manifest.error.detail}` };
  }
  const version = installedVersionOf({ manifestText: manifest.value });
  if (version.outcome === "failed") {
    return { outcome: "failed", error: `${request.name} at ${folder}: ${version.error.detail}` };
  }
  const caret = caretRangeOf({ range: request.range });
  if (caret.outcome === "failed") {
    return { outcome: "failed", error: `${request.name} is published as ${request.range}, which is not a caret range of one release` };
  }
  return caretFitOf({ range: caret.value, version: version.value }) === "within"
    ? { outcome: "ok", value: `${request.name} ${version.value}` }
    : { outcome: "failed", error: `${request.name} is ${version.value} at ${folder}, outside the published ${request.range}` };
};

const dependenciesBesideInstall = (request: {
  readonly context: ProofContext;
  readonly repo: string;
  readonly consumer: string;
  readonly installed: string;
  readonly ranges: DependencyRanges;
}): Result<null, string> => {
  const besideInstall = folderAbove({
    context: request.context,
    folder: request.context.path.join({ segments: [request.repo, request.installed] }),
    levels: TOOL_IDENTITY.packageName.split(PACKAGE_NAME_SEPARATOR).length,
  });
  const resolved = Object.entries(request.ranges).reduce<Result<readonly string[], string>>(
    (sofar, [name, range]) => {
      if (sofar.outcome === "failed") {
        return sofar;
      }
      const installed = installedDependencyOf({ context: request.context, besideInstall, name, range });
      return installed.outcome === "failed" ? installed : { outcome: "ok", value: [...sofar.value, installed.value] };
    },
    { outcome: "ok", value: [] },
  );
  if (resolved.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: ${request.consumer} resolves each dependency beside the package: ${resolved.error}` };
  }
  request.context.process.writeOut({
    text: `ok: ${request.consumer} resolves ${resolved.value.join(", ")} beside the package, within each published range, where pnpm installed it\n`,
  });
  return SUCCEEDED;
};

const installedConsumer = (request: CaseRequest & { readonly repo: string }): Result<null, string> => {
  const devDependencies = consumerDependenciesOf(request);
  if (devDependencies.outcome === "failed") {
    return devDependencies;
  }
  const context = request.context;
  const consumer = request.proofCase.consumer;
  return inOrder({
    steps: [
      () =>
        preparedConsumer({
          context,
          fixture: consumerFixture(request),
          repo: request.repo,
          files: consumerFiles({ devDependencies: devDependencies.value, settings: request.settings, proofCase: request.proofCase }),
        }),
      () =>
        ranCommand({
          context,
          label: `pnpm install the packed tarball into ${consumer}`,
          command: "pnpm",
          arguments: PNPM_INSTALL,
          directory: request.repo,
        }),
      () => packageShipsNoSource({ context, consumer, installedPackage: context.path.join({ segments: [request.repo, LINKED_INSTALL] }) }),
    ],
  });
};

const provenCase = (request: CaseRequest): Result<null, string> => {
  const context = request.context;
  const consumer = request.proofCase.consumer;
  const repo = consumerRepo(request);
  const installed = installedConsumer({ ...request, repo });
  if (installed.outcome === "failed") {
    return installed;
  }
  const location = installedLocationOf({ context, repo, consumer });
  if (location.outcome === "failed") {
    return location;
  }
  return inOrder({
    steps: [
      () => dependenciesBesideInstall({ context, repo, consumer, installed: location.value, ranges: request.settings.dependencyRanges }),
      () => git({ context, repo, consumer, arguments: ["init", "-q"] }),
      () => commitAll({ context, repo, consumer, message: "consumer" }),
      ...request.proofCase.actions.map(
        (action): Step =>
          () =>
            performedAction({ context, repo, consumer, action }),
      ),
    ],
  });
};

const provenInside = (request: ProofInputs & { readonly proofCases: readonly ProofCase[] }): Result<null, string> =>
  inOrder({
    steps: request.proofCases.map(
      (proofCase): Step =>
        () =>
          provenCase({ ...request, proofCase }),
    ),
  });

type TarballSource = { readonly kind: "packed-here" } | { readonly kind: "given"; readonly path: string };

const TARBALL_OPTION = "--tarball";
const GIVEN_TARBALL_FOLDER = "given-tarball";
const GIVEN_TARBALL_NAME = `${packageFileStemOf({ packageName: TOOL_IDENTITY.packageName })}.tgz`;

const unrecognisedArguments = (request: { readonly arguments: readonly string[] }): Result<TarballSource, string> => ({
  outcome: "failed",
  error: `FAIL: install-proof takes no arguments, to pack the package itself, or ${TARBALL_OPTION} <path>, to prove a packed tarball; got ${JSON.stringify(request.arguments)}`,
});

const tarballSourceOf = (request: { readonly path: PathPort; readonly arguments: readonly string[] }): Result<TarballSource, string> => {
  if (request.arguments.length === 0) {
    return { outcome: "ok", value: { kind: "packed-here" } };
  }
  const [option, given, ...rest] = request.arguments;
  if (option !== TARBALL_OPTION || given === undefined || rest.length > 0) {
    return unrecognisedArguments(request);
  }
  const resolved = request.path.resolve({ path: given });
  return resolved.outcome === "failed"
    ? { outcome: "failed", error: `FAIL: resolve ${given}: the working directory is unusable` }
    : { outcome: "ok", value: { kind: "given", path: resolved.value } };
};

const copiedTarball = (request: { readonly context: ProofContext; readonly given: string; readonly temporaryRoot: string }): Result<string, string> => {
  const copy = request.context.path.join({ segments: [request.temporaryRoot, GIVEN_TARBALL_FOLDER, GIVEN_TARBALL_NAME] });
  const copied = labelled({
    label: `copy ${request.given} into the temporary consumer root`,
    result: request.context.scratch.copyTree({ from: request.given, to: copy, disposition: () => "kept" }),
  });
  return copied.outcome === "failed" ? copied : { outcome: "ok", value: copy };
};

const tarballToProve = (request: {
  readonly context: ProofContext;
  readonly packer: TarballPackerPort;
  readonly source: TarballSource;
  readonly temporaryRoot: string;
}): Promise<Result<string, string>> =>
  request.source.kind === "given"
    ? Promise.resolve(copiedTarball({ context: request.context, given: request.source.path, temporaryRoot: request.temporaryRoot }))
    : request.packer.pack({ packageRoot: request.context.packageRoot, workRoot: request.temporaryRoot });

const provenWithTarball = async (request: {
  readonly context: ProofContext;
  readonly packer: TarballPackerPort;
  readonly source: TarballSource;
  readonly temporaryRoot: string;
  readonly packageManifest: string;
  readonly settings: InstallSettings;
  readonly proofCases: readonly ProofCase[];
}): Promise<Result<null, string>> => {
  const tarball = await tarballToProve(request);
  return tarball.outcome === "failed" ? tarball : provenInside({ ...request, tarball: tarball.value });
};

const provenWithin = async (request: {
  readonly context: ProofContext;
  readonly packer: TarballPackerPort;
  readonly source: TarballSource;
  readonly packageManifest: string;
  readonly settings: InstallSettings;
  readonly proofCases: readonly ProofCase[];
}): Promise<Result<null, string>> => {
  const temporaryRoot = labelled({
    label: "create the temporary consumer root",
    result: request.context.scratch.createTemporaryDirectory({ prefix: TEMPORARY_PREFIX }),
  });
  if (temporaryRoot.outcome === "failed") {
    return temporaryRoot;
  }
  const proven = await provenWithTarball({ ...request, temporaryRoot: temporaryRoot.value });
  const removed = labelled({
    label: "remove the temporary consumer root",
    result: request.context.scratch.removeTree({ path: temporaryRoot.value }),
  });
  return proven.outcome === "failed" ? proven : removed;
};
const FOLDERS_BETWEEN_PACKAGE_ROOT_AND_SCRIPT = 2;

const packageRootOf = (request: { readonly path: PathPort; readonly moduleUrl: string }): Result<string, string> => {
  const entryPath = request.path.fromFileUrl({ url: request.moduleUrl });
  if (entryPath.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: locate the package root: ${entryPath.error.detail}` };
  }
  return {
    outcome: "ok",
    value: Array.from({ length: FOLDERS_BETWEEN_PACKAGE_ROOT_AND_SCRIPT + 1 }).reduce<string>(
      (path) => request.path.directoryOf({ path }),
      entryPath.value,
    ),
  };
};

const readPackageFile = (request: { readonly context: ProofContext; readonly name: string }): Result<string, string> =>
  labelled({
    label: `read ${request.name}`,
    result: request.context.fileText.read({
      path: request.context.path.join({ segments: [request.context.packageRoot, request.name] }),
    }),
  });

const installSettingsOf = (request: { readonly context: ProofContext; readonly packageManifest: string }): Result<InstallSettings, string> => {
  const packageManager = labelled({ label: "package.json", result: packageManagerPinOf({ developmentManifest: request.packageManifest }) });
  if (packageManager.outcome === "failed") {
    return packageManager;
  }
  const workspaceSettings = readPackageFile({ context: request.context, name: "pnpm-workspace.yaml" });
  if (workspaceSettings.outcome === "failed") {
    return workspaceSettings;
  }
  const minimumReleaseAge = labelled({ label: "pnpm-workspace.yaml", result: minimumReleaseAgeOf({ workspaceSettings: workspaceSettings.value }) });
  if (minimumReleaseAge.outcome === "failed") {
    return minimumReleaseAge;
  }
  const dependencyRanges = labelled({ label: "package.json", result: dependencyRangesOf({ developmentManifest: request.packageManifest }) });
  return dependencyRanges.outcome === "failed"
    ? dependencyRanges
    : {
        outcome: "ok",
        value: { packageManager: packageManager.value, minimumReleaseAge: minimumReleaseAge.value, dependencyRanges: dependencyRanges.value },
      };
};

const proof = (request: {
  readonly context: ProofContext;
  readonly packer: TarballPackerPort;
  readonly source: TarballSource;
  readonly proofCases: readonly ProofCase[];
}): Promise<Result<null, string>> => {
  const packageManifest = readPackageFile({ context: request.context, name: "package.json" });
  if (packageManifest.outcome === "failed") {
    return Promise.resolve(packageManifest);
  }
  const settings = installSettingsOf({ context: request.context, packageManifest: packageManifest.value });
  if (settings.outcome === "failed") {
    return Promise.resolve(settings);
  }
  return provenWithin({
    context: request.context,
    packer: request.packer,
    source: request.source,
    packageManifest: packageManifest.value,
    settings: settings.value,
    proofCases: request.proofCases,
  });
};
const proofOutcome = (request: InstallProofRequest): Promise<Result<null, string>> => {
  const packageRoot = packageRootOf({ path: request.path, moduleUrl: request.moduleUrl });
  if (packageRoot.outcome === "failed") {
    return Promise.resolve(packageRoot);
  }
  const source = tarballSourceOf({ path: request.path, arguments: request.process.arguments });
  if (source.outcome === "failed") {
    return Promise.resolve(source);
  }
  return proof({
    packer: request.packer,
    source: source.value,
    context: {
      process: request.process,
      path: request.path,
      fileText: request.fileText,
      scratch: request.scratch,
      commands: request.commands,
      packageRoot: packageRoot.value,
    },
    proofCases: request.proofCases,
  });
};

export const runInstallProof = async (request: InstallProofRequest): Promise<void> => {
  const outcome = await proofOutcome(request);
  if (outcome.outcome === "failed") {
    request.process.writeOut({ text: `${outcome.error}\n` });
    request.process.exitWith({ code: 1 });
    return;
  }
  request.process.writeOut({ text: PASS_LINE });
  request.process.exitWith({ code: 0 });
};
