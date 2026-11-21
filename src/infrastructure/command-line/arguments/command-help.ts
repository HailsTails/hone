import { TOOL_IDENTITY } from "../../../domain/rule-set/tool-identity.ts";
import { COMMANDS, type CommandOption, type CommandSpec, HELP_FLAGS, type HelpTopic, SUBCOMMANDS, type Subcommand, VERSION_FLAG } from "./command-line.ts";

type HelpEntry = {
  readonly term: string;
  readonly text: string;
};

const COMMAND = TOOL_IDENTITY.command;

const INDENT = "  ";

const DESCRIPTION_INDENT = "      ";

const COLUMN_GAP = 2;

const HELP_TERM = HELP_FLAGS.join(", ");

const alignedEntries = (request: { readonly entries: readonly HelpEntry[] }): readonly string[] => {
  const width = Math.max(...request.entries.map((entry) => entry.term.length)) + COLUMN_GAP;
  return request.entries.map((entry) => `${INDENT}${entry.term.padEnd(width)}${entry.text}`);
};

const stackedEntries = (request: { readonly entries: readonly HelpEntry[] }): readonly string[] =>
  request.entries.flatMap((entry) => [`${INDENT}${entry.term}`, `${DESCRIPTION_INDENT}${entry.text}`]);

const usageTerm = (request: { readonly option: CommandOption }): string => {
  const term = `${request.option.name} ${request.option.value}`;
  const given = request.option.need === "required" ? term : `[${term}]`;
  return request.option.occurrence === "repeated" ? `${given}...` : given;
};

const commandUsage = (request: { readonly subcommand: Subcommand; readonly spec: CommandSpec }): string =>
  `${COMMAND} ${request.subcommand} ${request.spec.options.map((option) => usageTerm({ option })).join(" ")}`;

const helpLines = (request: { readonly blocks: readonly (readonly string[])[] }): string =>
  `${request.blocks.map((block) => block.join("\n")).join("\n\n")}\n`;

const toolHelp = (): string =>
  helpLines({
    blocks: [
      [`usage: ${COMMAND} <command> [options]`],
      [TOOL_IDENTITY.description],
      ["commands:", ...alignedEntries({ entries: SUBCOMMANDS.map((subcommand) => ({ term: subcommand, text: COMMANDS[subcommand].summary })) })],
      [
        "options:",
        ...alignedEntries({
          entries: [
            { term: HELP_TERM, text: "print this help; after a command, print that command's help" },
            { term: VERSION_FLAG, text: `print the installed version of ${TOOL_IDENTITY.packageName}` },
          ],
        }),
      ],
      [`run ${COMMAND} <command> --help for a command's options and exit codes`],
    ],
  });

const subcommandHelp = (request: { readonly subcommand: Subcommand; readonly spec: CommandSpec }): string =>
  helpLines({
    blocks: [
      [`usage: ${commandUsage(request)}`],
      [request.spec.summary],
      [
        "options:",
        ...stackedEntries({
          entries: [
            ...request.spec.options.map((option) => ({ term: `${option.name} ${option.value}`, text: option.summary })),
            { term: HELP_TERM, text: "print this help" },
          ],
        }),
      ],
      ["exit codes:", ...alignedEntries({ entries: request.spec.exits.map((exit) => ({ term: String(exit.code), text: exit.meaning })) })],
    ],
  });

export const helpText = (request: { readonly topic: HelpTopic }): string =>
  request.topic === "tool" ? toolHelp() : subcommandHelp({ subcommand: request.topic, spec: COMMANDS[request.topic] });

const SYNOPSIS_LINES: readonly string[] = [
  ...SUBCOMMANDS.map((subcommand) => commandUsage({ subcommand, spec: COMMANDS[subcommand] })),
  `${COMMAND} ${HELP_FLAGS[0]}`,
  `${COMMAND} ${VERSION_FLAG}`,
];

export const SYNOPSIS = `${SYNOPSIS_LINES.join("\n")}\n`;
