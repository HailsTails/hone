import { CHECK_ADDRESS_SEPARATOR } from "../../../../../domain/language-layer/check-address-text.ts";
import { projectionOutputsOf } from "../../../../../domain/repository/projection-outputs.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { CHECKS_PLUGIN_NAMESPACE } from "../hone-plugin/check-rule-id.ts";
import type { RuleOptions } from "../pieces/eslint-piece-settings-schema.ts";
import { enabledRuleEntry } from "../toolchain/eslint-instance.ts";
import { escapedGlobPath } from "./projection.ts";

export type ProjectedCheck = {
  readonly symptom: string;
  readonly check: string;
  readonly ruleId: string;
  readonly options: RuleOptions;
};

export type AnsweredFile = {
  readonly symptom: string;
  readonly check?: string;
  readonly file: RepoPath;
};

type AnsweredGroup = { readonly reaches: readonly string[]; readonly files: readonly RepoPath[] };

type RuleEntry = { readonly ruleId: string; readonly entry: string };

const ESLINT_OUTPUTS = projectionOutputsOf({ engineName: "eslint" });

export const CHECKS_PROJECTION_PATH: RepoPath = repoPathSchema.parse(ESLINT_OUTPUTS.configuration);

export const CHECKS_DECLARATION_PATH: RepoPath = repoPathSchema.parse(ESLINT_OUTPUTS.declaration);

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

const checksBlock = (request: { readonly checks: readonly ProjectedCheck[] }): string =>
  `{ name: ${quoted({ text: CHECKS_BLOCK })}, files: [${quoted({ text: SOURCE_FILES })}], plugins: { ${CHECKS_PLUGIN_NAMESPACE} }, rules: ${rulesText({ rules: enabledRules(request) })} }`;

const reachOfAnswer = (request: { readonly answer: AnsweredFile }): string =>
  request.answer.check === undefined
    ? request.answer.symptom
    : `${request.answer.symptom}${CHECK_ADDRESS_SEPARATOR}${request.answer.check}`;

const reachesOfCheck = (request: { readonly check: ProjectedCheck }): readonly string[] => [
  request.check.symptom,
  `${request.check.symptom}${CHECK_ADDRESS_SEPARATOR}${request.check.check}`,
];

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

export const checksProjectionText = (request: {
  readonly pluginImport: string;
  readonly checks: readonly ProjectedCheck[];
  readonly answered: readonly AnsweredFile[];
}): string => {
  const blocks = [
    checksBlock(request),
    ...answeredGroupsOf(request).map((group) => answeredBlock({ group, checks: request.checks })),
  ];
  return `import ${CHECKS_PLUGIN_NAMESPACE} from ${quoted({ text: request.pluginImport })};\nexport default [${blocks.join(",\n")}];\n`;
};
