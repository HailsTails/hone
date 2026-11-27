import type { NamedEngineRunRequest } from "../../../../application/ports/engine/engine-run.ts";
import type { FileTextPort } from "../../../../application/ports/file-system/file-text-port.ts";
import { gatheredOutcomes, listedOutcome } from "../../../../domain/gathered-outcomes.ts";
import { createDefaultFileTextPort } from "../../../node/file-system/file-text-port.ts";
import { installRootOfRunnerEntry } from "../../../node/modules/package-location-port.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";
import { runConfiguredOxlint } from "../../../node/process/configured-oxlint.ts";
import { runOxlint, type RunOxlint } from "../../../node/process/oxlint-port.ts";
import type { RunnerFileScope } from "../../protocol/checks/checks-runner-module-schema.ts";
import type {
  NamedChecksRunner,
  NamedChecksRunReport,
} from "../../protocol/checks/checks-runner-types.ts";
import { observeProjection, type ScopeObservation } from "./projection/observe.ts";
import { createProjectionPlan } from "./projection/project.ts";
import { createProjectionPath, findUntrackedConfig } from "./projection/scopes.ts";
import { readRule, type SelectedOxlintRule } from "./selected-rule.ts";

const installRoot = installRootOfRunnerEntry({ entryFile: import.meta.filename });

const createRuleRequest = (
  rules: readonly SelectedOxlintRule[],
): Pick<Parameters<RunOxlint>[0], "rules" | "pluginRules" | "nativeOptions"> => {
  const native = rules.filter((rule) => rule.kind === "native");
  const pluginRules = rules.filter((rule) => rule.kind === "plugin");
  return {
    rules: native.map(({ id }) => id),
    nativeOptions: new Map(native.map(({ id, options }) => [id, options])),
    ...(pluginRules.length > 0 ? { pluginRules } : {}),
  };
};

const path = createDefaultPathPort({});

const reportOf = (request: {
  readonly observations: readonly ScopeObservation[];
}): NamedChecksRunReport => {
  const [root, ...packages] = request.observations;
  return {
    projection: root?.state ?? "current",
    projectionFile: createProjectionPath(""),
    slices: packages.flatMap(({ file, state }): NamedChecksRunReport["slices"] =>
      state === "current" ? [] : [{ file, state }],
    ),
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
    const observed = gatheredOutcomes({
      outcomes: await Promise.all(
        scopes.map(async (scope) =>
          listedOutcome({
            outcome: await observeProjection({
              ...ports,
              scope,
              rules,
              repoRoot: request.repoRoot,
              answered: request.answered,
            }),
          }),
        ),
      ),
    });
    if (observed.outcome === "failed") return observed;
    return { outcome: "ok", value: reportOf({ observations: observed.value }) };
  };

const project: NamedChecksRunner["project"] = (request) => {
  const planned = createProjectionPlan(request);
  return Promise.resolve(
    planned.outcome === "failed" ? planned : { outcome: "ok", value: planned.value.entries },
  );
};

const createConform =
  (lint: RunOxlint): NamedChecksRunner["conform"] =>
  async ({ binding, cases }) => {
    const rule = readRule({ installRoot, binding });
    if (rule.outcome === "failed") return rule;
    const workingDirectory = path.resolve({ path: "." });
    if (workingDirectory.outcome === "failed") {
      return {
        outcome: "failed",
        error: { kind: "tool-failed", detail: "Hone cannot resolve the working directory" },
      };
    }
    const linted = await lint({
      resolveFrom: workingDirectory.value,
      ...createRuleRequest([rule.value]),
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
  readonly fileText: Pick<FileTextPort, "read" | "exists">;
};

export const createOxlintRunner = (
  ports: OxlintRunnerPorts,
): NamedChecksRunner & {
  readonly fileScope: RunnerFileScope;
  readonly projectedKinds: readonly ["config-override", "inline-disable"];
} => ({
  fileScope: "typescript",
  projectedKinds: ["config-override", "inline-disable"],
  run: createRun(ports),
  conform: createConform(ports.lint),
  project,
});

export const namedChecksRunner = createOxlintRunner({
  lint: runOxlint,
  configured: runConfiguredOxlint,
  fileText: createDefaultFileTextPort({}),
});
