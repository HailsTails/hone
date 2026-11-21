import type { ExitCode } from "../../node/process/process-port.ts";
import { PRUNE_DEBT_SUBCOMMAND, RECORD_DEBT_SUBCOMMAND } from "./subcommand-names.ts";
import { FORFEITURE_ASSESSMENTS } from "../../../domain/settings/assessment.ts";
import { REPORT_OUTPUTS } from "../../../domain/settings/report-output.ts";

export const SPLIT_RECORDS_SUBCOMMAND = "split-records";

export const AUTHORISE_SUBCOMMAND = "authorise";

export const UPGRADE_SUBCOMMAND = "upgrade";

export const SUBCOMMANDS = ["check", "project", RECORD_DEBT_SUBCOMMAND, PRUNE_DEBT_SUBCOMMAND, AUTHORISE_SUBCOMMAND, SPLIT_RECORDS_SUBCOMMAND, UPGRADE_SUBCOMMAND] as const;

export type Subcommand = (typeof SUBCOMMANDS)[number];

export type HelpTopic = "tool" | Subcommand;

export type OptionName =
  | "--repo"
  | "--base-revision"
  | "--report-output"
  | "--forfeiture"
  | "--leave"
  | "--answers"
  | "--file"
  | "--case"
  | "--owes"
  | "--why"
  | "--because"
  | "--evidence"
  | "--root-cause"
  | "--root-evidence"
  | "--readback"
  | "--owner";

export type CommandOption = {
  readonly name: OptionName;
  readonly value: string;
  readonly need: "required" | "optional";
  readonly occurrence: "once" | "repeated";
  readonly summary: string;
};

export type ExitMeaning = {
  readonly code: ExitCode;
  readonly meaning: string;
};

export type CommandSpec = {
  readonly summary: string;
  readonly options: readonly CommandOption[];
  readonly exits: readonly ExitMeaning[];
};

export const HELP_FLAGS: readonly string[] = ["--help", "-h"];

export const VERSION_FLAG = "--version";

const choiceValue = (request: { readonly choices: readonly string[] }): string => `<${request.choices.join("|")}>`;

export const REPO_OPTION: CommandOption = {
  name: "--repo",
  value: "<dir>",
  need: "required",
  occurrence: "once",
  summary: "the folder that holds disciplines.json, usually the repository root",
};

export const AUTHORISE_REPO_OPTION: CommandOption = {
  ...REPO_OPTION,
  summary: "the folder that holds hone.config.json, usually the repository root",
};

export const BASE_REVISION_OPTION: CommandOption = {
  name: "--base-revision",
  value: "<revision>",
  need: "optional",
  occurrence: "once",
  summary: "the revision the change is measured from; without it no file carve-out can be forfeited",
};

export const REPORT_OUTPUT_OPTION: CommandOption = {
  name: "--report-output",
  value: choiceValue({ choices: REPORT_OUTPUTS }),
  need: "optional",
  occurrence: "once",
  summary: "how much of the report to print, over reportOutput in disciplines.json; full when neither is set",
};

export const FORFEITURE_OPTION: CommandOption = {
  name: "--forfeiture",
  value: choiceValue({ choices: FORFEITURE_ASSESSMENTS }),
  need: "optional",
  occurrence: "once",
  summary: "assess file carve-out decay in this run or leave it to another, over assessment.forfeiture in disciplines.json; this-run when neither is set",
};

export const ADOPTION_BASE_REVISION_OPTION: CommandOption = {
  name: "--base-revision",
  value: "<revision>",
  need: "required",
  occurrence: "once",
  summary: "the branch's base, the revision the run that assesses decay is given, such as origin/main; a file it does not hold gets no record",
};

export const LEAVE_OPTION: CommandOption = {
  name: "--leave",
  value: "<path>",
  need: "optional",
  occurrence: "repeated",
  summary: "a file or folder, relative to --repo, that gets no record because a person records it as an authorised location; give it once for each path",
};

const onceRequired = (request: { readonly name: OptionName; readonly value: string; readonly summary: string }): CommandOption => ({
  ...request,
  need: "required",
  occurrence: "once",
});

const repeatedRequired = (request: { readonly name: OptionName; readonly value: string; readonly summary: string }): CommandOption => ({
  ...request,
  need: "required",
  occurrence: "repeated",
});

export const AUTHORISE_COMMAND_OPTIONS: readonly CommandOption[] = [
  onceRequired({ name: "--answers", value: "<address>", summary: "the symptom, or the symptom#check, the location answers, by the catalogue's names" }),
  onceRequired({ name: "--file", value: "<path>", summary: "the file the location is for, relative to --repo" }),
  onceRequired({ name: "--case", value: "<case>", summary: "the case the file is, as the cases page names it" }),
  onceRequired({ name: "--owes", value: "<principle>", summary: "the principle the case owes, as the cases page names it" }),
  repeatedRequired({ name: "--why", value: "<question>", summary: "one why of the chain, a question; give it, --because and --evidence once for each why, in order" }),
  repeatedRequired({ name: "--because", value: "<answer>", summary: "the answer to the why in the same place" }),
  repeatedRequired({ name: "--evidence", value: "<evidence>", summary: "what shows the answer, for the why in the same place" }),
  onceRequired({ name: "--root-cause", value: "<text>", summary: "the cause the fifth why names" }),
  onceRequired({ name: "--root-evidence", value: "<text>", summary: "the evidence that the cause still holds: what was run or read today, and what it showed" }),
  onceRequired({ name: "--readback", value: "<text>", summary: "the chain read back from the cause to the file" }),
  onceRequired({ name: "--owner", value: "<owner>", summary: "who decides whether this stays" }),
];

export const COMMANDS: Readonly<Record<Subcommand, CommandSpec>> = {
  check: {
    summary: "check the repository against the disciplines it selects and print the report, ending in its verdict",
    options: [REPO_OPTION, BASE_REVISION_OPTION, REPORT_OUTPUT_OPTION, FORFEITURE_OPTION],
    exits: [
      { code: 0, meaning: "the verdict is pass" },
      { code: 1, meaning: "the verdict is fail" },
      { code: 2, meaning: "a load failure: an input could not be loaded, a mechanism failed, or Hone failed unexpectedly" },
    ],
  },
  project: {
    summary: "write the native configuration each selected embedded mechanism needs, printing each file as written or unchanged",
    options: [REPO_OPTION],
    exits: [
      { code: 0, meaning: "every projection was written or already current" },
      { code: 2, meaning: "any failure" },
    ],
  },
  [RECORD_DEBT_SUBCOMMAND]: {
    summary: "add a file carve-out naming only its clause and file to the exception records for each clause and file the check finds broken, as inherited debt, printing each pair and what was done",
    options: [REPO_OPTION, ADOPTION_BASE_REVISION_OPTION, LEAVE_OPTION],
    exits: [
      { code: 0, meaning: "every record needed was written, or none was needed" },
      { code: 2, meaning: "a load failure: an input could not be loaded, a mechanism failed, the records could not be written, or Hone failed unexpectedly" },
    ],
  },
  [PRUNE_DEBT_SUBCOMMAND]: {
    summary: "remove from the exception records each stale or forfeited file carve-out whose file no longer exists or whose clause its mechanism measured on that file with nothing left to hold it, printing each pair removed",
    options: [REPO_OPTION, BASE_REVISION_OPTION, FORFEITURE_OPTION],
    exits: [
      { code: 0, meaning: "every paid record was removed, or none was paid" },
      { code: 2, meaning: "a load failure: an input could not be loaded, a mechanism failed, the records could not be written, or Hone failed unexpectedly" },
    ],
  },
  [AUTHORISE_SUBCOMMAND]: {
    summary: "write one authorised location to the records of a hone.config.json repository from the arguments given, with the why chain given, printing what was done",
    options: [AUTHORISE_REPO_OPTION, ...AUTHORISE_COMMAND_OPTIONS],
    exits: [
      { code: 0, meaning: "the location was written, was already held, or was refused with each reason printed" },
      { code: 2, meaning: "a load failure: an input could not be loaded, the records could not be written, or Hone failed unexpectedly" },
    ],
  },
  [SPLIT_RECORDS_SUBCOMMAND]: {
    summary: "move the exception records from discipline-exceptions.json into the discipline-exceptions folder, one file for each record kind and discipline, printing each file as written or removed",
    options: [REPO_OPTION],
    exits: [
      { code: 0, meaning: "the records were split, or there was nothing to split" },
      { code: 2, meaning: "a load failure: the records could not be read, placed or written, or Hone failed unexpectedly" },
    ],
  },
  [UPGRADE_SUBCOMMAND]: {
    summary: "move a version 1 repository to version 2: write hone.config.json, the hone-records folder and the projection, check that version 2 reports what version 1 reported, then remove the version 1 files",
    options: [REPO_OPTION],
    exits: [
      { code: 0, meaning: "the repository was upgraded, or is already on version 2" },
      { code: 1, meaning: "the upgrade was refused; it changed nothing, or named each file it could not put back" },
      { code: 2, meaning: "a load failure: an input could not be loaded, or Hone failed unexpectedly" },
      { code: 3, meaning: "version 2 is in place, but some version 1 files could not be removed; delete the files printed, then commit" },
    ],
  },
};

export const subcommandOf = (request: { readonly given: string | undefined }): Subcommand | undefined =>
  SUBCOMMANDS.find((subcommand) => subcommand === request.given);
