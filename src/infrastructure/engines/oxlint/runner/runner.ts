import { z } from "zod";

import type { NamedEngineRunRequest } from "../../../../application/ports/engine/engine-run.ts";
import type { FileTextPort } from "../../../../application/ports/file-system/file-text-port.ts";
import { gatheredOutcomes, listedOutcome } from "../../../../domain/gathered-outcomes.ts";
import type { RepoPath } from "../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../domain/result.ts";
import type { CheckBinding } from "../../../../domain/runner/check-binding.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import { createDefaultFileTextPort } from "../../../node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";
import {
  OXLINT_RULES,
  runOxlint,
  type OxlintRule,
  type RunOxlint,
} from "../../../node/process/oxlint-port.ts";
import type { RunnerFileScope } from "../../protocol/checks/checks-runner-module-schema.ts";
import type {
  NamedChecksRunner,
  NamedChecksRunReport,
} from "../../protocol/checks/checks-runner-types.ts";

const settingsSchema = z.strictObject({ rule: z.enum(OXLINT_RULES) });

const readRule = (binding: CheckBinding): Result<OxlintRule, RunnerFailure> => {
  const settings = settingsSchema.safeParse(binding.settings);
  return settings.success
    ? { outcome: "ok", value: settings.data.rule }
    : {
        outcome: "failed",
        error: {
          kind: "piece-invalid",
          pieceRoot: binding.pieceRoot,
          detail: z.prettifyError(settings.error),
        },
      };
};

const path = createDefaultPathPort({});

const readSource = ({
  fileText,
  repoRoot,
  fileName,
}: {
  readonly fileText: Pick<FileTextPort, "read">;
  readonly repoRoot: string;
  readonly fileName: RepoPath;
}): Result<{ readonly fileName: RepoPath; readonly source: string }, RunnerFailure> => {
  const read = fileText.read({ path: path.join({ segments: [repoRoot, fileName] }) });
  return read.outcome === "failed"
    ? {
        outcome: "failed",
        error: { kind: "tool-failed", detail: `${fileName}: ${read.error.detail}` },
      }
    : { outcome: "ok", value: { fileName, source: read.value } };
};

const createRun =
  (ports: OxlintRunnerPorts): NamedChecksRunner["run"] =>
  async (request: NamedEngineRunRequest) => {
    const report: NamedChecksRunReport = {
      slices: [],
      nestedConfigurations: [],
      unprojectedFolders: [],
      misnamedRuleIds: [],
      nativeExceptions: [],
      hits: [],
      measured: [],
      projection: "none",
    };
    const read = gatheredOutcomes({
      outcomes: request.files.map((file) =>
        listedOutcome({
          outcome: readSource({
            fileText: ports.fileText,
            repoRoot: request.repoRoot,
            fileName: file,
          }),
        }),
      ),
    });
    if (read.outcome === "failed") return read;
    const sources = read.value;
    const checks = gatheredOutcomes({
      outcomes: request.bindings.map((binding) => {
        const rule = readRule(binding);
        return rule.outcome === "failed"
          ? rule
          : { outcome: "ok", value: [{ rule: rule.value, check: binding.address }] };
      }),
    });
    if (checks.outcome === "failed") return checks;
    const checksByRule = Map.groupBy(checks.value, ({ rule }) => rule);
    const linted = await ports.lint({
      resolveFrom: request.repoRoot,
      rules: [...checksByRule.keys()],
      sources,
    });
    if (linted.outcome === "failed") return linted;
    return {
      outcome: "ok",
      value: {
        ...report,
        measured: request.bindings.flatMap(({ address: check }) =>
          sources.map(({ fileName: file }) => ({ check, file })),
        ),
        hits: linted.value.flatMap(({ rule, index, line, column }) => {
          const { fileName: file, source } = sources[index];
          const snippet = source.split(/\r\n|[\n\r\u2028\u2029]/u)[line - 1]?.trim() ?? "";
          return (checksByRule.get(rule) ?? []).map(({ check }) => ({
            check,
            file,
            anchor: { line, column },
            snippet,
          }));
        }),
      },
    };
  };

const createConform =
  (lint: RunOxlint): NamedChecksRunner["conform"] =>
  async ({ binding, cases }) => {
    const rule = readRule(binding);
    if (rule.outcome === "failed") return rule;
    const linted = await lint({
      resolveFrom: binding.pieceRoot,
      rules: [rule.value],
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
  readonly fileText: Pick<FileTextPort, "read">;
};

export const createOxlintRunner = (
  ports: OxlintRunnerPorts,
): NamedChecksRunner & {
  readonly fileScope: RunnerFileScope;
  readonly projectedKinds: readonly [];
} => ({
  fileScope: "typescript",
  projectedKinds: [],
  run: createRun(ports),
  conform: createConform(ports.lint),
  project: () => Promise.resolve({ outcome: "ok", value: [] }),
});

export const namedChecksRunner = createOxlintRunner({
  lint: runOxlint,
  fileText: createDefaultFileTextPort({}),
});
