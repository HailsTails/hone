import { type RepoPath, repoPathSchema } from "../../hone-records-folder/repo-path.ts";
import { type ForfeitureAssessment, forfeitureAssessmentSchema, WAIVED_CLAUSES_REPLACEMENT } from "../../hone-config-file/assessment.ts";
import type { Result } from "../../../domain/result.ts";
import { type ArgumentProblem, argumentsInvalid } from "./argument-problem.ts";
import {
  ADOPTION_BASE_REVISION_OPTION,
  AUTHORISE_REPO_OPTION,
  BASE_REVISION_OPTION,
  COMMANDS,
  type CommandOption,
  FORFEITURE_OPTION,
  HELP_FLAGS,
  type HelpTopic,
  LEAVE_OPTION,
  type OptionName,
  REPO_OPTION,
  REPORT_OUTPUT_OPTION,
  type Subcommand,
  subcommandOf,
  VERSION_FLAG,
} from "./command-line.ts";
import type { LoadFailure } from "../load-failure.ts";

export type CheckArguments<Output extends string> = {
  readonly repo: string;
  readonly baseRevision: string | undefined;
  readonly reportOutput: Output | undefined;
  readonly forfeiture: ForfeitureAssessment | undefined;
};

export type PruneDebtArguments = {
  readonly repo: string;
  readonly baseRevision: string | undefined;
  readonly forfeiture: ForfeitureAssessment | undefined;
};

export type ProjectArguments = {
  readonly repo: string;
};

export type SplitRecordsArguments = {
  readonly repo: string;
};

export type RecordDebtArguments = {
  readonly repo: string;
  readonly baseRevision: string;
  readonly leave: readonly RepoPath[];
};

export type Invocation =
  | { readonly kind: "run"; readonly subcommand: Subcommand; readonly arguments: readonly string[] }
  | { readonly kind: "help"; readonly topic: HelpTopic }
  | { readonly kind: "version" };

type OptionValues = ReadonlyMap<OptionName, readonly string[]>;

const FLAG_MARKER = "-";

const JOINED_VALUE_MARKER = "=";

const END_OF_OPTIONS = "--";

const REMOVED_OPTIONS: ReadonlyMap<string, string> = new Map([["--waived-clauses", WAIVED_CLAUSES_REPLACEMENT]]);

const failedWith = (request: { readonly problem: ArgumentProblem }): { readonly outcome: "failed"; readonly error: LoadFailure } =>
  argumentsInvalid(request);

const optionNamed = (request: { readonly subcommand: Subcommand; readonly given: string }): CommandOption | undefined =>
  COMMANDS[request.subcommand].options.find((option) => option.name === request.given);

const unknownArgumentProblem = (request: { readonly subcommand: Subcommand; readonly given: string }): ArgumentProblem => {
  if (!request.given.startsWith(FLAG_MARKER)) {
    return { kind: "argument-unexpected", ...request };
  }
  const joined = optionNamed({ subcommand: request.subcommand, given: request.given.split(JOINED_VALUE_MARKER)[0] });
  return joined === undefined ? { kind: "option-unknown", ...request } : { kind: "option-joined", option: joined, given: request.given };
};

const removedOptionProblem = (request: { readonly arguments: readonly string[] }): ArgumentProblem | undefined => {
  const removed = request.arguments.find((argument) => REMOVED_OPTIONS.has(argument));
  const instead = removed === undefined ? undefined : REMOVED_OPTIONS.get(removed);
  return removed === undefined || instead === undefined ? undefined : { kind: "option-removed", given: removed, instead };
};

const optionValuesFrom = (request: {
  readonly subcommand: Subcommand;
  readonly remaining: readonly string[];
  readonly given: OptionValues;
}): Result<OptionValues, LoadFailure> => {
  const [name, given, ...rest] = request.remaining;
  if (name === undefined) {
    return { outcome: "ok", value: request.given };
  }
  const option = optionNamed({ subcommand: request.subcommand, given: name });
  if (option === undefined) {
    return failedWith({ problem: unknownArgumentProblem({ subcommand: request.subcommand, given: name }) });
  }
  if (given === undefined || given.startsWith(FLAG_MARKER)) {
    return failedWith({ problem: { kind: "value-missing", option } });
  }
  const earlier = request.given.get(option.name) ?? [];
  if (earlier.length > 0 && option.occurrence === "once") {
    return failedWith({ problem: { kind: "option-repeated", option } });
  }
  return optionValuesFrom({ ...request, remaining: rest, given: new Map([...request.given, [option.name, [...earlier, given]]]) });
};

const withoutEndOfOptions = (request: { readonly remaining: readonly string[] }): readonly string[] => {
  const [name, ...rest] = request.remaining;
  if (name === undefined) {
    return [];
  }
  if (name === END_OF_OPTIONS) {
    return withoutEndOfOptions({ remaining: rest });
  }
  const [given, ...beyond] = rest;
  return given === undefined ? [name] : [name, given, ...withoutEndOfOptions({ remaining: beyond })];
};

const givenOptionValues = (request: {
  readonly subcommand: Subcommand;
  readonly arguments: readonly string[];
}): Result<OptionValues, LoadFailure> => {
  const removed = removedOptionProblem(request);
  if (removed !== undefined) {
    return failedWith({ problem: removed });
  }
  return optionValuesFrom({
    subcommand: request.subcommand,
    remaining: withoutEndOfOptions({ remaining: request.arguments }),
    given: new Map(),
  });
};

const singleValue = (request: { readonly option: CommandOption; readonly values: OptionValues }): string | undefined =>
  request.values.get(request.option.name)?.[0];

const requiredValue = (request: {
  readonly subcommand: Subcommand;
  readonly option: CommandOption;
  readonly values: OptionValues;
}): Result<string, LoadFailure> => {
  const given = singleValue(request);
  return given === undefined
    ? failedWith({ problem: { kind: "option-required", subcommand: request.subcommand, option: request.option } })
    : { outcome: "ok", value: given };
};

const requiredRepo = (request: { readonly subcommand: Subcommand; readonly values: OptionValues }): Result<string, LoadFailure> =>
  requiredValue({ ...request, option: REPO_OPTION });

const chosenValue = <Choice extends string>(request: {
  readonly option: CommandOption;
  readonly choices: readonly Choice[];
  readonly values: OptionValues;
}): Result<Choice | undefined, LoadFailure> => {
  const given = singleValue(request);
  const chosen = request.choices.find((choice) => choice === given);
  if (given !== undefined && chosen === undefined) {
    return failedWith({ problem: { kind: "choice-invalid", option: request.option, choices: request.choices, given } });
  }
  return { outcome: "ok", value: chosen };
};

const checkArgumentsOf = <Output extends string>(request: {
  readonly values: OptionValues;
  readonly reportOutputs: readonly Output[];
}): Result<CheckArguments<Output>, LoadFailure> => {
  const repo = requiredRepo({ subcommand: "check", values: request.values });
  if (repo.outcome === "failed") {
    return repo;
  }
  const reportOutput = chosenValue({ option: REPORT_OUTPUT_OPTION, choices: request.reportOutputs, values: request.values });
  if (reportOutput.outcome === "failed") {
    return reportOutput;
  }
  const forfeiture = chosenValue({ option: FORFEITURE_OPTION, choices: forfeitureAssessmentSchema.options, values: request.values });
  if (forfeiture.outcome === "failed") {
    return forfeiture;
  }
  return {
    outcome: "ok",
    value: {
      repo: repo.value,
      baseRevision: singleValue({ option: BASE_REVISION_OPTION, values: request.values }),
      reportOutput: reportOutput.value,
      forfeiture: forfeiture.value,
    },
  };
};

export const parseCheckArguments = <Output extends string>(request: {
  readonly arguments: readonly string[];
  readonly reportOutputs: readonly Output[];
}): Result<CheckArguments<Output>, LoadFailure> => {
  const values = givenOptionValues({ subcommand: "check", arguments: request.arguments });
  return values.outcome === "failed" ? values : checkArgumentsOf({ values: values.value, reportOutputs: request.reportOutputs });
};

const pruneDebtArgumentsOf = (request: { readonly values: OptionValues }): Result<PruneDebtArguments, LoadFailure> => {
  const repo = requiredRepo({ subcommand: "prune-debt", values: request.values });
  if (repo.outcome === "failed") {
    return repo;
  }
  const forfeiture = chosenValue({ option: FORFEITURE_OPTION, choices: forfeitureAssessmentSchema.options, values: request.values });
  return forfeiture.outcome === "failed"
    ? forfeiture
    : {
        outcome: "ok",
        value: {
          repo: repo.value,
          baseRevision: singleValue({ option: BASE_REVISION_OPTION, values: request.values }),
          forfeiture: forfeiture.value,
        },
      };
};

export const parsePruneDebtArguments = (request: {
  readonly arguments: readonly string[];
}): Result<PruneDebtArguments, LoadFailure> => {
  const values = givenOptionValues({ subcommand: "prune-debt", arguments: request.arguments });
  return values.outcome === "failed" ? values : pruneDebtArgumentsOf({ values: values.value });
};

export const parseProjectArguments = (request: {
  readonly arguments: readonly string[];
}): Result<ProjectArguments, LoadFailure> => {
  const values = givenOptionValues({ subcommand: "project", arguments: request.arguments });
  if (values.outcome === "failed") {
    return values;
  }
  const repo = requiredRepo({ subcommand: "project", values: values.value });
  return repo.outcome === "failed" ? repo : { outcome: "ok", value: { repo: repo.value } };
};

export const parseSplitRecordsArguments = (request: {
  readonly arguments: readonly string[];
}): Result<SplitRecordsArguments, LoadFailure> => {
  const values = givenOptionValues({ subcommand: "split-records", arguments: request.arguments });
  if (values.outcome === "failed") {
    return values;
  }
  const repo = requiredRepo({ subcommand: "split-records", values: values.value });
  return repo.outcome === "failed" ? repo : { outcome: "ok", value: { repo: repo.value } };
};

export type UpgradeArguments = {
  readonly repo: string;
};

export const parseUpgradeArguments = (request: {
  readonly arguments: readonly string[];
}): Result<UpgradeArguments, LoadFailure> => {
  const values = givenOptionValues({ subcommand: "upgrade", arguments: request.arguments });
  if (values.outcome === "failed") {
    return values;
  }
  const repo = requiredRepo({ subcommand: "upgrade", values: values.value });
  return repo.outcome === "failed" ? repo : { outcome: "ok", value: { repo: repo.value } };
};

export type AuthoriseArguments = {
  readonly repo: string;
  readonly values: ReadonlyMap<string, readonly string[]>;
};

export const parseAuthoriseArguments = (request: {
  readonly arguments: readonly string[];
}): Result<AuthoriseArguments, LoadFailure> => {
  const values = givenOptionValues({ subcommand: "authorise", arguments: request.arguments });
  if (values.outcome === "failed") {
    return values;
  }
  const repo = requiredValue({ subcommand: "authorise", values: values.value, option: AUTHORISE_REPO_OPTION });
  return repo.outcome === "failed" ? repo : { outcome: "ok", value: { repo: repo.value, values: values.value } };
};

const GLOB_MARKER = "*";

const leavePaths = (request: { readonly values: OptionValues }): Result<readonly RepoPath[], LoadFailure> => {
  const given = request.values.get(LEAVE_OPTION.name) ?? [];
  const parsed = given.map((path) => ({ path, parsed: repoPathSchema.safeParse(path) }));
  const refused = parsed.find((entry) => !entry.parsed.success || entry.path.includes(GLOB_MARKER));
  if (refused !== undefined) {
    return failedWith({ problem: { kind: "path-invalid", option: LEAVE_OPTION, given: refused.path } });
  }
  return { outcome: "ok", value: parsed.flatMap((entry) => (entry.parsed.success ? [entry.parsed.data] : [])) };
};

const recordDebtArgumentsOf = (request: { readonly values: OptionValues }): Result<RecordDebtArguments, LoadFailure> => {
  const repo = requiredRepo({ subcommand: "record-debt", values: request.values });
  if (repo.outcome === "failed") {
    return repo;
  }
  const baseRevision = requiredValue({ subcommand: "record-debt", option: ADOPTION_BASE_REVISION_OPTION, values: request.values });
  if (baseRevision.outcome === "failed") {
    return baseRevision;
  }
  const leave = leavePaths(request);
  return leave.outcome === "failed"
    ? leave
    : { outcome: "ok", value: { repo: repo.value, baseRevision: baseRevision.value, leave: leave.value } };
};

export const parseRecordDebtArguments = (request: {
  readonly arguments: readonly string[];
}): Result<RecordDebtArguments, LoadFailure> => {
  const values = givenOptionValues({ subcommand: "record-debt", arguments: request.arguments });
  return values.outcome === "failed" ? values : recordDebtArgumentsOf({ values: values.value });
};

const optionNamePositions = (request: { readonly arguments: readonly string[] }): readonly string[] =>
  withoutEndOfOptions({ remaining: request.arguments }).filter((_, position) => position % 2 === 0);

const asksForHelp = (request: { readonly arguments: readonly string[] }): "help" | "no-help" =>
  optionNamePositions(request).some((argument) => HELP_FLAGS.includes(argument)) ? "help" : "no-help";

const toolFlagOf = (request: { readonly given: string | undefined }): "help" | "version" | undefined => {
  if (request.given !== undefined && HELP_FLAGS.includes(request.given)) {
    return "help";
  }
  return request.given === VERSION_FLAG ? "version" : undefined;
};

const toolFlagInvocation = (request: {
  readonly flag: "help" | "version";
  readonly given: string;
  readonly rest: readonly string[];
}): Result<Invocation, LoadFailure> => {
  const [after, ...beyond] = request.rest;
  if (after === undefined) {
    return { outcome: "ok", value: request.flag === "help" ? { kind: "help", topic: "tool" } : { kind: "version" } };
  }
  const topic = request.flag === "help" && beyond.length === 0 ? subcommandOf({ given: after }) : undefined;
  return topic === undefined
    ? failedWith({ problem: { kind: "flag-extra", flag: request.given, given: after } })
    : { outcome: "ok", value: { kind: "help", topic } };
};

export const parseInvocation = (request: { readonly arguments: readonly string[] }): Result<Invocation, LoadFailure> => {
  const [given, ...rest] = request.arguments;
  const flag = toolFlagOf({ given });
  if (flag !== undefined && given !== undefined) {
    return toolFlagInvocation({ flag, given, rest });
  }
  const subcommand = subcommandOf({ given });
  if (subcommand === undefined) {
    return failedWith({ problem: given === undefined ? { kind: "command-missing" } : { kind: "command-unknown", given } });
  }
  return {
    outcome: "ok",
    value:
      asksForHelp({ arguments: rest }) === "help"
        ? { kind: "help", topic: subcommand }
        : { kind: "run", subcommand, arguments: rest },
  };
};
