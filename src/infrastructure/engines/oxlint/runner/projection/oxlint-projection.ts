import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import { checkNamesOf } from "../../../../../domain/language-layer/check-address-text.ts";
import { TOOL_IDENTITY } from "../../../../../domain/rule-set/tool-identity.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type {
  AnsweredFile,
  ProjectedFile,
} from "../../../../../domain/runner/checks-run-report.ts";
import type { ReadonlyJsonValue } from "../../../../../domain/settings/json-values/json-value.ts";
import type { SelectedOxlintRule } from "../selected-rule.ts";
import type { ProjectionScope } from "./scopes.ts";

export type ProjectionRule = { readonly binding: CheckBinding; readonly rule: SelectedOxlintRule };

type ConfigRule = readonly ["error", ...ReadonlyJsonValue[]] | "off";

export type OxlintProjectionConfig = {
  readonly jsPlugins: readonly { readonly name: string; readonly specifier: string }[];
  readonly overrides: readonly {
    readonly files: readonly string[];
    readonly rules: Readonly<Record<string, ConfigRule>>;
  }[];
};

const pluginSpecifier = (request: {
  readonly path: PathPort;
  readonly installRoot: string;
  readonly root: string;
  readonly module: string;
}): string => {
  const packaged = request.path.relative({ from: request.installRoot, to: request.module });
  if (
    packaged.relation === "within-root" &&
    !packaged.path.startsWith("..") &&
    packaged.path.endsWith(".js")
  ) {
    return `${TOOL_IDENTITY.packageName}/${packaged.path.replaceAll("\\", "/")}`;
  }
  const relative = request.path.relative({ from: request.root, to: request.module });
  return relative.relation === "within-root"
    ? `./${relative.path.replaceAll("\\", "/")}`
    : request.module;
};

export const answersCheck = (request: {
  readonly answer: AnsweredFile;
  readonly binding: CheckBinding;
}) => {
  const { answer, binding } = request;
  const names = checkNamesOf({ text: binding.address });
  const sameRuleSet =
    typeof answer.ruleSet === "string" || typeof binding.ruleSet === "string"
      ? answer.ruleSet === binding.ruleSet
      : answer.ruleSet.name === binding.ruleSet.name;
  return (
    sameRuleSet &&
    names?.symptom === answer.symptom &&
    (answer.check === undefined || names.check === answer.check)
  );
};

const createOverride = (request: {
  readonly file: string;
  readonly answers: readonly AnsweredFile[];
  readonly rules: readonly ProjectionRule[];
}): OxlintProjectionConfig["overrides"] => {
  const rules = request.rules
    .filter(({ binding }) => request.answers.some((answer) => answersCheck({ binding, answer })))
    .map(({ rule }) => [rule.id, "off"] as const);
  return rules.length === 0
    ? []
    : [
        {
          files: [`./${request.file.replace(/[?*\[\]{}!]/gu, "\\$&")}`],
          rules: Object.fromEntries(rules),
        },
      ];
};

export const createOxlintProjection = (request: {
  readonly path: PathPort;
  readonly root: string;
  readonly installRoot: string;
  readonly scope: ProjectionScope;
  readonly rules: readonly ProjectionRule[];
  readonly answers: readonly AnsweredFile[];
}): { readonly file: ProjectedFile; readonly config: OxlintProjectionConfig } => {
  const { scope } = request;
  const root = request.path.join({ segments: [request.root, scope.folder] });
  const selected = request.rules
    .map(({ rule }) => rule)
    .toSorted((left, right) => left.id.localeCompare(right.id, "en"));
  const plugins = new Map(
    selected.flatMap((rule) =>
      rule.kind === "plugin" ? [[rule.namespace, rule.module] as const] : [],
    ),
  );
  const files = new Set(scope.files);
  const answers = Map.groupBy(
    request.answers.filter(({ file }) => files.has(file)),
    ({ file }) => file,
  );
  const config: OxlintProjectionConfig = {
    jsPlugins: [...plugins].map(([name, module]) => ({
      name,
      specifier: pluginSpecifier({ ...request, root, module }),
    })),
    overrides: [
      {
        files: ["**/*.{ts,tsx,mts,cts}"],
        rules: Object.fromEntries(selected.map(({ id, options }) => [id, ["error", ...options]])),
      },
      ...[...answers.keys()].toSorted().flatMap((file) =>
        createOverride({
          file: scope.folder === "" ? file : file.slice(scope.folder.length + 1),
          answers: answers.get(file) ?? [],
          rules: request.rules,
        }),
      ),
    ],
  };
  return {
    file: { kind: "write", file: scope.file, text: `${JSON.stringify(config, null, 2)}\n` },
    config,
  };
};
