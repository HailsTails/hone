import { describe, expect, it } from "vitest";

import { RUN_SYNOPSIS, RUN_SUBCOMMANDS, runHelpText } from "./run-help.ts";

describe("the version 2 commands", () => {
  it("are check, project, record-debt, prune-debt, authorise and upgrade, with split-records gone", () => {
    expect(RUN_SUBCOMMANDS).toEqual([
      "check",
      "project",
      "record-debt",
      "prune-debt",
      "authorise",
      "upgrade",
    ]);
  });

  it("print a synopsis of every command's usage", () => {
    expect(RUN_SYNOPSIS)
      .toBe(`hone check --repo <dir> [--base-revision <revision>] [--report-output <full|actionable|counts|verdict-only>] [--forfeiture <this-run|elsewhere|no-new-findings>]
hone project --repo <dir>
hone record-debt --repo <dir> --base-revision <revision> [--leave <path>]...
hone prune-debt --repo <dir> [--base-revision <revision>] [--forfeiture <this-run|elsewhere>]
hone authorise --repo <dir> --answers <address> --file <path> [--outside-party <party>] --case <case> --owes <principle> --why <question>... --because <answer>... --evidence <evidence>... --root-cause <text> --root-evidence <text> --readback <text> --owner <owner>
hone upgrade --repo <dir>
hone --help
hone --version
`);
  });
});

describe("runHelpText", () => {
  it("prints the tool's help with each command's summary", () => {
    expect(runHelpText({ topic: "tool" })).toBe(`usage: hone <command> [options]

Checks a repository against the checks hone.config.json lists, answers its findings by the records in hone-records and prints one verdict.

commands:
  check        check the repository against the checks hone.config.json lists and print the report, ending in its verdict
  project      write the native configuration, hone.<engine>.mjs, and any file that types it beside it, for each engine that runs a listed check through one, printing each file as written or unchanged
  record-debt  add debt to hone-records for each symptom and file the check finds, printing each and what was done
  prune-debt   remove from hone-records the debt a run shows is paid, stale or forfeited, printing each debt removed
  authorise    write one authorised location to hone-records from the arguments given, with the why chain given, printing what was done
  upgrade      move a version 1 repository to version 2: write hone.config.json, the hone-records folder and the projection, check that version 2 reports what version 1 reported, then remove the version 1 files

options:
  --help, -h  print this help; after a command, print that command's help
  --version   print the installed version of @hailstails/hone

run hone <command> --help for a command's options and exit codes
`);
  });

  it("prints a command's options and exit codes in version 2's words", () => {
    expect(runHelpText({ topic: "check" }))
      .toBe(`usage: hone check --repo <dir> [--base-revision <revision>] [--report-output <full|actionable|counts|verdict-only>] [--forfeiture <this-run|elsewhere|no-new-findings>]

check the repository against the checks hone.config.json lists and print the report, ending in its verdict

options:
  --repo <dir>
      the folder that holds hone.config.json, usually the repository root
  --base-revision <revision>
      the revision the change is measured from; without it no debt can be forfeited and no carried record is checked against it
  --report-output <full|actionable|counts|verdict-only>
      how much of the report to print, over reportOutput in hone.config.json; full when neither is set
  --forfeiture <this-run|elsewhere|no-new-findings>
      assess debt now, leave it to another run, or compare counted debt with a pinned landing commit in no-new-findings
  --help, -h
      print this help

exit codes:
  0  the verdict is pass
  1  the verdict is fail
  2  a load failure: an input could not be loaded, an engine failed, or Hone failed unexpectedly
`);
  });

  it("prints upgrade's help, the one new command", () => {
    expect(runHelpText({ topic: "upgrade" })).toBe(`usage: hone upgrade --repo <dir>

move a version 1 repository to version 2: write hone.config.json, the hone-records folder and the projection, check that version 2 reports what version 1 reported, then remove the version 1 files

options:
  --repo <dir>
      the folder that holds disciplines.json, usually the repository root
  --help, -h
      print this help

exit codes:
  0  the repository was upgraded, or is already on version 2
  1  the upgrade was refused; it changed nothing, or named each file it could not put back
  2  a load failure: an input could not be loaded, or Hone failed unexpectedly
  3  version 2 is in place, but some version 1 files could not be removed; delete the files printed, then commit
`);
  });

  it("prints prune-debt's help with its exit code 0 agreeing with its summary", () => {
    expect(runHelpText({ topic: "prune-debt" }))
      .toBe(`usage: hone prune-debt --repo <dir> [--base-revision <revision>] [--forfeiture <this-run|elsewhere>]

remove from hone-records the debt a run shows is paid, stale or forfeited, printing each debt removed

options:
  --repo <dir>
      the folder that holds hone.config.json, usually the repository root
  --base-revision <revision>
      the revision the change is measured from; without it no debt can be forfeited and no carried record is checked against it
  --forfeiture <this-run|elsewhere>
      check debt for forfeiture in this run or leave it to another, over forfeiture in hone.config.json; this-run when neither is set
  --help, -h
      print this help

exit codes:
  0  every debt the run showed paid, stale or forfeited was removed, or none was shown
  2  a load failure: an input could not be loaded, an engine failed, the records could not be written, or Hone failed unexpectedly
`);
  });
});

const SPLIT_RECORDS_HELP = `usage: hone split-records --repo <dir>

move the exception records from discipline-exceptions.json into the discipline-exceptions folder, one file for each record kind and discipline, printing each file as written or removed

options:
  --repo <dir>
      the folder that holds disciplines.json, usually the repository root
  --help, -h
      print this help

exit codes:
  0  the records were split, or there was nothing to split
  2  a load failure: the records could not be read, placed or written, or Hone failed unexpectedly
`;

const UPGRADE_HELP = `usage: hone upgrade --repo <dir>

move a version 1 repository to version 2: write hone.config.json, the hone-records folder and the projection, check that version 2 reports what version 1 reported, then remove the version 1 files

options:
  --repo <dir>
      the folder that holds disciplines.json, usually the repository root
  --help, -h
      print this help

exit codes:
  0  the repository was upgraded, or is already on version 2
  1  the upgrade was refused; it changed nothing, or named each file it could not put back
  2  a load failure: an input could not be loaded, or Hone failed unexpectedly
  3  version 2 is in place, but some version 1 files could not be removed; delete the files printed, then commit
`;

describe("runHelpText for migration commands", () => {
  it("gives the upgrade command its usage, its one option and its four exit codes", () => {
    expect(runHelpText({ topic: "upgrade" })).toBe(UPGRADE_HELP);
  });

  it("gives the split-records command its usage, what it does, its one option and its exit codes", () => {
    expect(runHelpText({ topic: "split-records" })).toBe(SPLIT_RECORDS_HELP);
  });
});
