import { describe, expect, it } from "vitest";
import { helpText, SYNOPSIS } from "./command-help.ts";

const TOOL_HELP = `usage: hone <command> [options]

Checks a repository against the disciplines it selects, applies its recorded exceptions and prints one verdict.

commands:
  check          check the repository against the disciplines it selects and print the report, ending in its verdict
  project        write the native configuration each selected embedded mechanism needs, printing each file as written or unchanged
  record-debt    add a file carve-out naming only its clause and file to the exception records for each clause and file the check finds broken, as inherited debt, printing each pair and what was done
  prune-debt     remove from the exception records each stale or forfeited file carve-out whose file no longer exists or whose clause its mechanism measured on that file with nothing left to hold it, printing each pair removed
  authorise      write one authorised location to the records of a hone.config.json repository from the arguments given, with the why chain given, printing what was done
  split-records  move the exception records from discipline-exceptions.json into the discipline-exceptions folder, one file for each record kind and discipline, printing each file as written or removed
  upgrade        move a version 1 repository to version 2: write hone.config.json, the hone-records folder and the projection, check that version 2 reports what version 1 reported, then remove the version 1 files

options:
  --help, -h  print this help; after a command, print that command's help
  --version   print the installed version of @hailstails/hone

run hone <command> --help for a command's options and exit codes
`;

const PROJECT_HELP = `usage: hone project --repo <dir>

write the native configuration each selected embedded mechanism needs, printing each file as written or unchanged

options:
  --repo <dir>
      the folder that holds disciplines.json, usually the repository root
  --help, -h
      print this help

exit codes:
  0  every projection was written or already current
  2  any failure
`;

const RECORD_DEBT_HELP = `usage: hone record-debt --repo <dir> --base-revision <revision> [--leave <path>]...

add a file carve-out naming only its clause and file to the exception records for each clause and file the check finds broken, as inherited debt, printing each pair and what was done

options:
  --repo <dir>
      the folder that holds disciplines.json, usually the repository root
  --base-revision <revision>
      the branch's base, the revision the run that assesses decay is given, such as origin/main; a file it does not hold gets no record
  --leave <path>
      a file or folder, relative to --repo, that gets no record because a person records it as an authorised location; give it once for each path
  --help, -h
      print this help

exit codes:
  0  every record needed was written, or none was needed
  2  a load failure: an input could not be loaded, a mechanism failed, the records could not be written, or Hone failed unexpectedly
`;

const PRUNE_DEBT_HELP = `usage: hone prune-debt --repo <dir> [--base-revision <revision>] [--forfeiture <this-run|elsewhere>]

remove from the exception records each stale or forfeited file carve-out whose file no longer exists or whose clause its mechanism measured on that file with nothing left to hold it, printing each pair removed

options:
  --repo <dir>
      the folder that holds disciplines.json, usually the repository root
  --base-revision <revision>
      the revision the change is measured from; without it no file carve-out can be forfeited
  --forfeiture <this-run|elsewhere>
      assess file carve-out decay in this run or leave it to another, over assessment.forfeiture in disciplines.json; this-run when neither is set
  --help, -h
      print this help

exit codes:
  0  every paid record was removed, or none was paid
  2  a load failure: an input could not be loaded, a mechanism failed, the records could not be written, or Hone failed unexpectedly
`;

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

describe("helpText", () => {
  it("gives the upgrade command its usage, its one option and its four exit codes", () => {
    expect(helpText({ topic: "upgrade" })).toBe(UPGRADE_HELP);
  });

  it("gives the split-records command its usage, what it does, its one option and its exit codes", () => {
    expect(helpText({ topic: "split-records" })).toBe(SPLIT_RECORDS_HELP);
  });

  it("marks a required option without brackets and a repeatable one with a trailing ellipsis", () => {
    expect(helpText({ topic: "record-debt" })).toBe(RECORD_DEBT_HELP);
  });

  it("gives the prune-debt command the check's base revision and forfeiture options, each optional", () => {
    expect(helpText({ topic: "prune-debt" })).toBe(PRUNE_DEBT_HELP);
  });

  it("describes the authorise command's --repo as the folder that holds hone.config.json", () => {
    expect(helpText({ topic: "authorise" })).toContain("\n  --repo <dir>\n      the folder that holds hone.config.json, usually the repository root\n");
  });

  it("lists the commands and the tool's own options", () => {
    expect(helpText({ topic: "tool" })).toBe(TOOL_HELP);
  });

  it("gives a command its usage line, each option with what it does, and its exit codes", () => {
    expect(helpText({ topic: "project" })).toBe(PROJECT_HELP);
  });

  it("puts each optional check option in brackets on the usage line, with its accepted values", () => {
    expect(helpText({ topic: "check" })).toMatch(
      /^usage: hone check --repo <dir> \[--base-revision <revision>\] \[--report-output <full\|failures-only\|counts\|verdict-only>\] \[--forfeiture <this-run\|elsewhere>\]\n/,
    );
  });

  it("names the check exit codes", () => {
    expect(helpText({ topic: "check" })).toContain(
      "\nexit codes:\n  0  the verdict is pass\n  1  the verdict is fail\n  2  a load failure: an input could not be loaded, a mechanism failed, or Hone failed unexpectedly\n",
    );
  });
});

describe("SYNOPSIS", () => {
  it("lists each command's usage, then the tool's own flags", () => {
    expect(SYNOPSIS).toBe(
      "hone check --repo <dir> [--base-revision <revision>] [--report-output <full|failures-only|counts|verdict-only>] [--forfeiture <this-run|elsewhere>]\nhone project --repo <dir>\nhone record-debt --repo <dir> --base-revision <revision> [--leave <path>]...\nhone prune-debt --repo <dir> [--base-revision <revision>] [--forfeiture <this-run|elsewhere>]\nhone authorise --repo <dir> --answers <address> --file <path> --case <case> --owes <principle> --why <question>... --because <answer>... --evidence <evidence>... --root-cause <text> --root-evidence <text> --readback <text> --owner <owner>\nhone split-records --repo <dir>\nhone upgrade --repo <dir>\nhone --help\nhone --version\n",
    );
  });
});
