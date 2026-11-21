import { removedText } from "../../hone-config-file/assessment.ts";
import { TOOL_IDENTITY } from "../../../domain/rule-set/tool-identity.ts";
import { COMMANDS, type CommandOption, REPO_OPTION, SUBCOMMANDS, type Subcommand } from "./command-line.ts";
import type { LoadFailure } from "../load-failure.ts";

export type ArgumentProblem =
  | { readonly kind: "command-missing" }
  | { readonly kind: "command-unknown"; readonly given: string }
  | { readonly kind: "flag-extra"; readonly flag: string; readonly given: string }
  | { readonly kind: "argument-unexpected"; readonly subcommand: Subcommand; readonly given: string }
  | { readonly kind: "option-unknown"; readonly subcommand: Subcommand; readonly given: string }
  | { readonly kind: "option-joined"; readonly option: CommandOption; readonly given: string }
  | { readonly kind: "value-missing"; readonly option: CommandOption }
  | { readonly kind: "option-repeated"; readonly option: CommandOption }
  | { readonly kind: "option-required"; readonly subcommand: Subcommand; readonly option: CommandOption }
  | {
      readonly kind: "choice-invalid";
      readonly option: CommandOption;
      readonly choices: readonly string[];
      readonly given: string;
    }
  | { readonly kind: "option-removed"; readonly given: string; readonly instead: string }
  | { readonly kind: "repo-unresolvable"; readonly given: string }
  | { readonly kind: "path-invalid"; readonly option: CommandOption; readonly given: string };

const COMMAND = TOOL_IDENTITY.command;

const listed = (request: { readonly items: readonly string[] }): string =>
  request.items.length < 2
    ? request.items.join("")
    : `${request.items.slice(0, -1).join(", ")} or ${request.items.at(-1)}`;

const conjoined = (request: { readonly items: readonly string[] }): string =>
  `${request.items.slice(0, -1).join(", ")} and ${request.items.at(-1)}`;

const optionsHelp = (request: { readonly subcommand: Subcommand }): string =>
  `run ${COMMAND} ${request.subcommand} --help for its options`;

const TOOL_HELP_POINTER = `run ${COMMAND} --help for usage`;

const commandProblemText = (request: { readonly given: string | undefined }): string =>
  request.given === undefined
    ? `${COMMAND} needs a command, ${listed({ items: SUBCOMMANDS })}; ${TOOL_HELP_POINTER}`
    : `${COMMAND} has no command ${JSON.stringify(request.given)}; its commands are ${conjoined({ items: SUBCOMMANDS })}; ${TOOL_HELP_POINTER}`;

const optionUsage = (request: { readonly option: CommandOption }): string =>
  `${request.option.name} ${request.option.value}`;

const exampleOption = (request: { readonly subcommand: Subcommand }): CommandOption =>
  COMMANDS[request.subcommand].options.find((option) => option.need === "required") ?? REPO_OPTION;

export const argumentProblemText = (request: { readonly problem: ArgumentProblem }): string => {
  const { problem } = request;
  switch (problem.kind) {
    case "command-missing":
      return commandProblemText({ given: undefined });
    case "command-unknown":
      return commandProblemText(problem);
    case "flag-extra":
      return `${COMMAND} ${problem.flag} takes nothing after it, not ${JSON.stringify(problem.given)}; ${TOOL_HELP_POINTER}`;
    case "argument-unexpected":
      return `${COMMAND} ${problem.subcommand} takes options, not ${JSON.stringify(problem.given)} on its own; give each option and its value as two arguments, as in ${optionUsage({ option: exampleOption(problem) })}; ${optionsHelp(problem)}`;
    case "option-unknown":
      return `${COMMAND} ${problem.subcommand} has no option ${JSON.stringify(problem.given)}; ${optionsHelp(problem)}`;
    case "option-joined":
      return `give ${problem.option.name} and its value as two arguments, as in ${optionUsage(problem)}, not ${JSON.stringify(problem.given)}`;
    case "value-missing":
      return `${problem.option.name} needs a value, as in ${optionUsage(problem)}`;
    case "option-repeated":
      return `${problem.option.name} is given more than once; give it once`;
    case "option-required":
      return `${COMMAND} ${problem.subcommand} needs ${optionUsage(problem)}: ${problem.option.summary}`;
    case "choice-invalid":
      return `${problem.option.name} takes ${listed({ items: problem.choices })}, not ${JSON.stringify(problem.given)}`;
    case "option-removed":
      return removedText({ removed: problem.given, instead: problem.instead });
    case "repo-unresolvable":
      return `--repo ${problem.given} resolves to no absolute path`;
    case "path-invalid":
      return `${problem.option.name} takes one exact file or folder inside ${REPO_OPTION.name}, relative to it, with forward slashes and no *, not ${JSON.stringify(problem.given)}`;
  }
};

export const argumentsInvalid = (request: {
  readonly problem: ArgumentProblem;
}): { readonly outcome: "failed"; readonly error: LoadFailure } => ({
  outcome: "failed",
  error: { kind: "arguments-invalid", detail: argumentProblemText(request) },
});
