import type {
  NamedEngineProjection,
  NamedEngineRunRequest,
} from "../../../../application/ports/engine/engine-run.ts";
import type { FileTextPort } from "../../../../application/ports/file-system/file-text-port.ts";
import { gatheredOutcomes, listedOutcome } from "../../../../domain/gathered-outcomes.ts";
import { createDefaultFileTextPort } from "../../../node/file-system/file-text-port.ts";
import { installRootOfRunnerEntry } from "../../../node/modules/package-location-port.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";
import type { RunnerFileScope } from "../../protocol/checks/checks-runner-module-schema.ts";
import type {
  NamedChecksRunner,
  NamedChecksRunReport,
} from "../../protocol/checks/checks-runner-types.ts";
import { observeProjection, type ScopeObservation } from "./projection/observe.ts";
import { createProjectionPlan } from "./projection/project.ts";
import { createProjectionPath, findUntrackedConfig } from "./projection/scopes.ts";
import { listPeerFolders, readRule } from "./selected-rule.ts";
import { runConfiguredOxlint } from "./toolchain/configured-oxlint.ts";
import { runOxlint, type RunOxlint } from "./toolchain/oxlint-port.ts";
import { readOxlintToolchain, type OxlintToolchain } from "./toolchain/oxlint-toolchain.ts";

const installRoot = installRootOfRunnerEntry({ entryFile: import.meta.filename });

const path = createDefaultPathPort({});
const DISABLE_CONFIGURATION =
  "src/infrastructure/engines/oxlint/runner/toolchain/disable-inspection.json";

const instructionsToIncludeProjection = (file: ScopeObservation["file"]): string => {
  const separator = file.lastIndexOf("/");
  const location =
    separator === -1 ? "for the files under check" : `in ${file.slice(0, separator)}`;
  return `extend ./${file.slice(separator + 1)} from the Oxlint configuration ${location}, after any configuration that changes the selected rules`;
};

const instructionsForMissingConfiguration = (file: ScopeObservation["file"]): string => {
  const separator = file.lastIndexOf("/");
  const folder = separator === -1 ? "the repository root" : file.slice(0, separator);
  return `${folder} has no tracked Oxlint config; add and track one, or exclude files outside your intended scope and remove any obsolete projection`;
};

const createRootProjection = (root: ScopeObservation | undefined): NamedEngineProjection => {
  if (root === undefined || root.state === "unconfigured") return { projection: "none" };
  const { state, file } = root;
  return state === "not-included"
    ? {
        projection: state,
        projectionFile: file,
        recovery: { kind: "engine-instructions", detail: instructionsToIncludeProjection(file) },
      }
    : { projection: state, projectionFile: file };
};

const createReport = (request: {
  readonly observations: readonly ScopeObservation[];
}): NamedChecksRunReport => {
  const rootFile = createProjectionPath("");
  const root = request.observations.find(({ file }) => file === rootFile);
  return {
    ...createRootProjection(root),
    slices: request.observations.flatMap(({ file, state }): NamedChecksRunReport["slices"] => {
      if (state === "unconfigured") {
        return [
          {
            file,
            state,
            recovery: {
              kind: "engine-instructions",
              detail: instructionsForMissingConfiguration(file),
            },
          },
        ];
      }
      if (state === "current" || file === rootFile) return [];
      if (state === "not-included") {
        return [
          {
            file,
            state,
            recovery: {
              kind: "engine-instructions",
              detail: instructionsToIncludeProjection(file),
            },
          },
        ];
      }
      return [{ file, state }];
    }),
    nestedConfigurations: [],
    unprojectedFolders: [],
    misnamedRuleIds: [],
    hits: request.observations.flatMap(({ hits }) => hits),
    measured: request.observations.flatMap(({ measured }) => measured),
    nativeExceptions: request.observations.flatMap(({ nativeExceptions }) => nativeExceptions),
  };
};

const createRun =
  (ports: OxlintRunnerPorts): NamedChecksRunner["run"] =>
  async (request: NamedEngineRunRequest) => {
    const untracked = findUntrackedConfig({
      ...request,
      exists: (file) =>
        ports.fileText.exists({ path: path.join({ segments: [request.repoRoot, file] }) }),
    });
    if (untracked !== undefined)
      return {
        outcome: "failed",
        error: {
          kind: "tool-failed",
          detail: `Track the Oxlint configuration at ${untracked} before running Hone`,
        },
      };
    const planned = createProjectionPlan(request);
    if (planned.outcome === "failed") return planned;
    const { scopes, rules } = planned.value;
    const peerFolders = listPeerFolders(rules.map(({ rule }) => rule));
    const disableConfiguration = path.join({
      segments: [request.installRoot, DISABLE_CONFIGURATION],
    });
    let toolchain: OxlintToolchain | undefined;
    const resolveCli = () =>
      (toolchain ??= ports.readToolchain({ folder: request.repoRoot, peerFolders }));
    const observed = gatheredOutcomes({
      outcomes: scopes.map((scope) =>
        listedOutcome({
          outcome: observeProjection({
            ...ports,
            scope,
            rules,
            resolveCli,
            disableConfiguration,
            repoRoot: request.repoRoot,
          }),
        }),
      ),
    });
    if (observed.outcome === "failed") return observed;
    return { outcome: "ok", value: createReport({ observations: observed.value }) };
  };

const project: NamedChecksRunner["project"] = (request) => {
  const planned = createProjectionPlan(request);
  return Promise.resolve(
    planned.outcome === "failed" ? planned : { outcome: "ok", value: planned.value.entries },
  );
};

const createConform =
  (ports: Pick<OxlintRunnerPorts, "lint" | "readToolchain">): NamedChecksRunner["conform"] =>
  async ({ binding, cases }) => {
    const rule = readRule({ binding });
    if (rule.outcome === "failed") return rule;
    const workingDirectory = path.resolve({ path: "." });
    if (workingDirectory.outcome === "failed") {
      return {
        outcome: "failed",
        error: { kind: "tool-failed", detail: "Hone cannot resolve the working directory" },
      };
    }
    const rules = [rule.value];
    const toolchain = ports.readToolchain({
      folder: workingDirectory.value,
      peerFolders: listPeerFolders(rules),
    });
    if (toolchain.outcome === "failed") return toolchain;
    const linted = await ports.lint({
      cli: toolchain.value,
      resolveFrom: workingDirectory.value,
      rules,
      sources: cases,
    });
    return linted.outcome === "failed"
      ? linted
      : {
          outcome: "ok",
          value: cases.map(({ name }, index) => ({
            caseName: name,
            flaggedLines: linted.value
              .filter((site) => site.index === index)
              .map(({ line }) => line),
          })),
        };
  };

type OxlintRunnerPorts = {
  readonly lint: RunOxlint;
  readonly configured: typeof runConfiguredOxlint;
  readonly readToolchain: typeof readOxlintToolchain;
  readonly fileText: Pick<FileTextPort, "read" | "exists">;
};

export const createOxlintRunner = (
  ports: OxlintRunnerPorts,
): NamedChecksRunner & {
  readonly fileScope: RunnerFileScope;
  readonly projectedKinds: readonly ["inline-disable"];
} => ({
  fileScope: "typescript",
  projectedKinds: ["inline-disable"],
  run: createRun(ports),
  conform: createConform(ports),
  project,
});

export const namedChecksRunner = createOxlintRunner({
  lint: runOxlint,
  configured: runConfiguredOxlint,
  readToolchain: readOxlintToolchain,
  fileText: createDefaultFileTextPort({}),
});
