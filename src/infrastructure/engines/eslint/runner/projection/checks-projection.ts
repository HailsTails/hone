import { CHECK_ADDRESS_SEPARATOR } from "../../../../../domain/language-layer/check-address-text.ts";
import {
  type ProjectionKind,
  projectionOutputsOf,
} from "../../../../../domain/repository/projection-outputs.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { RuleSetIdentity } from "../../../../../domain/rule-set/clause-address-types.ts";
import { ownedNameText } from "../../../../../domain/rule-set/rule-set-identity.ts";
import type { AnsweredFile } from "../../../../../domain/runner/checks-run-report.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { CHECKS_PLUGIN_NAMESPACE } from "../hone-plugin/check-rule-id.ts";
import type { RuleOptions } from "../pieces/eslint-piece-settings-schema.ts";
import { enabledRuleEntry } from "../toolchain/eslint-instance.ts";
import { escapedGlobPath } from "./projection.ts";

export type ProjectedCheck = {
  readonly ruleSet: RuleSetIdentity;
  readonly symptom: string;
  readonly check: string;
  readonly ruleId: string;
  readonly options: RuleOptions;
  readonly plugin?: {
    readonly namespace: string;
    readonly module: string;
    readonly pieceRoot: string;
  };
};

export type ProjectedPlugin = { readonly namespace: string; readonly specifier: string };

type AnsweredGroup = { readonly reaches: readonly string[]; readonly files: readonly RepoPath[] };

type RuleEntry = { readonly ruleId: string; readonly entry: string };

export type ChecksProjectionOutputs =
  | { readonly kind: "mjs"; readonly configuration: RepoPath; readonly declaration: RepoPath }
  | { readonly kind: "ts"; readonly configuration: RepoPath };

export type ChecksProjectionForm =
  | { readonly kind: "mjs" }
  | { readonly kind: "ts"; readonly projectionTypeText: string };

const ESLINT_ENGINE_NAME = "eslint";

export const createChecksProjectionOutputs = (request: {
  readonly kind: ProjectionKind;
}): ChecksProjectionOutputs => {
  const outputs = projectionOutputsOf({ engineName: ESLINT_ENGINE_NAME, kind: request.kind });
  switch (outputs.kind) {
    case "mjs":
      return {
        kind: "mjs",
        configuration: repoPathSchema.parse(outputs.configuration),
        declaration: repoPathSchema.parse(outputs.declaration),
      };
    case "ts":
      return { kind: "ts", configuration: repoPathSchema.parse(outputs.configuration) };
  }
};

export const mapChecksProjectionOutputsToTypedFile = (request: {
  readonly outputs: ChecksProjectionOutputs;
}): RepoPath => {
  switch (request.outputs.kind) {
    case "mjs":
      return request.outputs.declaration;
    case "ts":
      return request.outputs.configuration;
  }
};

export const createChecksDeclarationText = (request: {
  readonly projectionTypeText: string;
}): string =>
  `declare const projection: ${request.projectionTypeText};\nexport default projection;\n`;

const SOURCE_FILES = "**/*.{ts,tsx,mts,cts}";

const CHECKS_BLOCK = `${CHECKS_PLUGIN_NAMESPACE}/checks`;

const ANSWERED_BLOCK = `${CHECKS_PLUGIN_NAMESPACE}/answered`;

const LIST_SEPARATOR = ", ";

const quoted = (request: { readonly text: string }): string => JSON.stringify(request.text);

const rulesText = (request: { readonly rules: readonly RuleEntry[] }): string => {
  const entries = request.rules.map((rule) => `${quoted({ text: rule.ruleId })}: ${rule.entry}`);
  return entries.length === 0 ? "{}" : `{ ${entries.join(LIST_SEPARATOR)} }`;
};

const enabledRules = (request: {
  readonly checks: readonly ProjectedCheck[];
}): readonly RuleEntry[] =>
  request.checks
    .map((check) => ({
      ruleId: check.ruleId,
      entry: JSON.stringify(enabledRuleEntry({ options: check.options })),
    }))
    .toSorted((left, right) => codeUnitOrder({ left: left.ruleId, right: right.ruleId }));

const codeUnitOrder = (request: { readonly left: string; readonly right: string }): number => {
  if (request.left < request.right) {
    return -1;
  }
  return request.left > request.right ? 1 : 0;
};

const checksBlock = (request: {
  readonly kind: ProjectionKind;
  readonly checks: readonly ProjectedCheck[];
  readonly plugins: readonly ProjectedPlugin[];
}): string => {
  const entries = request.plugins.map(
    ({ namespace }, index) => `${quoted({ text: namespace })}: plugin${index}`,
  );
  const typedFile = mapChecksProjectionOutputsToTypedFile({
    outputs: createChecksProjectionOutputs({ kind: request.kind }),
  });
  return `{ name: ${quoted({ text: CHECKS_BLOCK })}, files: [${quoted({ text: SOURCE_FILES })}], ignores: [${quoted({ text: typedFile })}], plugins: { ${[CHECKS_PLUGIN_NAMESPACE, ...entries].join(LIST_SEPARATOR)} }, rules: ${rulesText({ rules: enabledRules(request) })} }`;
};

const reachOfAnswer = (request: { readonly answer: AnsweredFile }): string =>
  ownedNameText({
    ruleSet: request.answer.ruleSet,
    name:
      request.answer.check === undefined
        ? request.answer.symptom
        : `${request.answer.symptom}${CHECK_ADDRESS_SEPARATOR}${request.answer.check}`,
  });

const reachesOfCheck = (request: { readonly check: ProjectedCheck }): readonly string[] =>
  [
    request.check.symptom,
    `${request.check.symptom}${CHECK_ADDRESS_SEPARATOR}${request.check.check}`,
  ].map((name) => ownedNameText({ ruleSet: request.check.ruleSet, name }));

const answeredGroupsOf = (request: {
  readonly checks: readonly ProjectedCheck[];
  readonly answered: readonly AnsweredFile[];
}): readonly AnsweredGroup[] => {
  const projectedReaches = new Set(request.checks.flatMap((check) => reachesOfCheck({ check })));
  const projectedAnswers = request.answered.filter((answer) =>
    projectedReaches.has(reachOfAnswer({ answer })),
  );
  const reachesByFile = [...Map.groupBy(projectedAnswers, (answer) => answer.file)].map(
    ([file, answers]) => ({
      file,
      reaches: [...new Set(answers.map((answer) => reachOfAnswer({ answer })))].toSorted(),
    }),
  );
  return [...Map.groupBy(reachesByFile, (entry) => entry.reaches.join(LIST_SEPARATOR))]
    .map(([reaches, entries]) => ({
      reaches: reaches.split(LIST_SEPARATOR),
      files: entries.map((entry) => entry.file).toSorted(),
    }))
    .toSorted((left, right) =>
      codeUnitOrder({
        left: left.reaches.join(LIST_SEPARATOR),
        right: right.reaches.join(LIST_SEPARATOR),
      }),
    );
};

const answeredBlock = (request: {
  readonly group: AnsweredGroup;
  readonly checks: readonly ProjectedCheck[];
}): string => {
  const offRules = request.checks
    .filter((check) =>
      reachesOfCheck({ check }).some((reach) => request.group.reaches.includes(reach)),
    )
    .map((check) => ({ ruleId: check.ruleId, entry: quoted({ text: "off" }) }))
    .toSorted((left, right) => codeUnitOrder({ left: left.ruleId, right: right.ruleId }));
  const files = request.group.files
    .map((file) => quoted({ text: escapedGlobPath({ path: file }) }))
    .join(LIST_SEPARATOR);
  return `{ name: ${quoted({ text: `${ANSWERED_BLOCK}/${request.group.reaches.join(LIST_SEPARATOR)}` })}, files: [${files}], rules: ${rulesText({ rules: offRules })} }`;
};

const exportedProjectionText = (request: {
  readonly form: ChecksProjectionForm;
  readonly blocks: readonly string[];
}): string => {
  const list = `[${request.blocks.join(",\n")}]`;
  switch (request.form.kind) {
    case "mjs":
      return `export default ${list};\n`;
    case "ts":
      return `const projection: ${request.form.projectionTypeText} = ${list};\nexport default projection;\n`;
  }
};

export const checksProjectionText = (request: {
  readonly form: ChecksProjectionForm;
  readonly pluginImport: string;
  readonly plugins?: readonly ProjectedPlugin[];
  readonly checks: readonly ProjectedCheck[];
  readonly answered: readonly AnsweredFile[];
}): string => {
  const plugins = request.plugins ?? [];
  const imports = plugins.map(
    ({ specifier }, index) => `import plugin${index} from ${quoted({ text: specifier })};\n`,
  );
  const blocks = [
    checksBlock({ kind: request.form.kind, checks: request.checks, plugins }),
    ...answeredGroupsOf(request).map((group) => answeredBlock({ group, checks: request.checks })),
  ];
  return `import ${CHECKS_PLUGIN_NAMESPACE} from ${quoted({ text: request.pluginImport })};\n${imports.join("")}${exportedProjectionText({ form: request.form, blocks })}`;
};
