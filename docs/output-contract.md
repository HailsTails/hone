# Output contract

This page lists everything the `hone` command prints, exactly as it prints it: the help, the version, the report, the load failures, the `hone project` lines, the `hone record-debt` lines, the `hone prune-debt` lines and the `hone split-records` lines. It says which parts a hook, CI job or agent can parse and rely on. [Compatibility](../README.md#compatibility) says which releases may change them.

A test renders every kind of line the command can print, fills each template below with that line's own sample values, and requires the result to equal the printed line exactly: a line Hone can print that is not listed here fails the build, and so does a line listed here that Hone cannot print. The synopsis and help blocks below are compared with what the command prints, character for character.

## Streams and exit codes

Hone prints everything to standard output: the report, the help, the version, `hone project`, `hone record-debt`, `hone prune-debt`, `hone split-records` and `hone upgrade` lines and every load failure, including an error Hone did not expect. Hone writes nothing to standard error itself; Node can write its own warnings there, so a hook should not read output on standard error as a failure.

The exit code is the signal a hook should act on:

- `0`: `hone check` printed `verdict: pass` or `verdict: pass (partial assessment)`, `hone project` wrote or confirmed every projection, `hone record-debt` wrote every record it needed or needed none, `hone prune-debt` removed every paid record or found none, `hone split-records` split the records or found nothing to split, `hone upgrade` upgraded the repository or found it already on version 2, or help or the version was printed;
- `1`: `hone check` printed `verdict: fail` or `verdict: fail (partial assessment)` as its last line, or `hone upgrade` refused to upgrade. Exit `1` from `hone check` always comes with one of those lines, and with nothing else; exit `1` from `hone upgrade` always comes with a line starting `upgrade refused:`, and either `Nothing was changed.` or each file it could not put back;
- `2`: Hone could not decide. It printed exactly one line, starting with `load failure: `, and no verdict. That covers a command typed wrongly, an input that could not be loaded, a mechanism that failed, records `hone record-debt`, `hone prune-debt` or `hone split-records` could not write or place, and an error Hone did not expect, which prints as `unexpected-error`;
- `3`: only `hone upgrade` exits with it. Version 2 is in place, but a version 1 file could not be removed. It printed `upgrade incomplete:` and the list of version 1 files to delete by hand, then commit.

A 1.0 hook can rely on this: run `hone check`, block on any non-zero exit, and show standard output as it came.

## What a tool can parse

A tool can rely on these, and a change to any of them is a major release:

- the command names, option names, option values, exit codes and streams above;
- the verdict line, which is always the last line of a `hone check` report and is one of the four lines under [The report](#the-report);
- the section names, their order and roles, the heading and count lines, and the output modes;
- the first word of a load failure after `load failure: `, its kind;
- in each line below, the fixed words and values up to the first value that may hold a space, and the single spaces between them.

The values in the [table of values](#values) marked "may hold a space" can contain spaces, and Hone does not quote or escape them. Everything from the first such value to the end of the line is one piece of text: a tool cannot split it into fields, and should not try. For a finding, a tool can read the clause and the mechanism; the file, position and snippet that follow are for a person. Hone has no machine-readable report yet, so a tool that needs each finding's file and position has nothing stable to read them from.

These are not stable, so a minor release may change them:

- the help text, though the synopsis and the exit codes it lists are stable;
- the text of a `<detail>`, which comes from Node, git, ESLint or a schema check;
- the wording after `load failure: arguments-invalid`, written for the person who typed the command;
- the text after a load failure's values, which says what to do next: the repair text of `selection-absent`, `judgement-clause-listed`, `config-root-untracked` and `why-chains-required`, and everything after the kind in `toolchain-unavailable` and `toolchain-shadowed`;
- the `readFirst` lines and their leading note, written for a person;
- the words of a finding's `<fix>`, and which `<fix page>` and `<section>` it names;
- the words of an `unmeasured` or `projectionProblems` line after the `:` that ends its leading fields (its kind and reason, or its mechanism, state and slice), which say why and what to do next;
- the words of a `hone record-debt` line after the `:` that follows its file, which say why no record was written and what to do instead.

A minor release may add a section, a kind of line in a section, a load failure kind, an option or a command. A tool reading the report should pass over a section heading or a line kind it does not know.

## Values

In the tables below, a word in angle brackets, such as `<clause>`, stands for a value; everything else is printed as shown. Every line ends with a line feed. A value that holds a line break prints it as `\n` or `\r`, so each entry and each load failure stays on one line.

| Value | Printed as | Space |
| --- | --- | --- |
| `<clause>` | in the report, a clause address: `CD-15#loops` (`loop-keyword#loop-statement`) for Hone's own rule set, `<rule set>/<ID>#<clause>` for a team's (`loop-keyword#loop-statement` is the check's name, given for reading: today's tool neither accepts nor prints a check's name, so write and expect the clause address; check names become typeable in 2.0); in a load failure, the address as written in `disciplines.json` | never in the report; may hold a space in a load failure |
| `<mechanism>` | a mechanism id, such as `audit` or `eslint` | never |
| `<record kind>`, `<section>`, `<package>` | a word from the lines below, a section name, or an npm package name | never |
| `<line>`, `<column>` | a 1-based line and a 0-based column | never |
| `<count>`, `<index>`, `<earlier index>` | a whole number; an index counts from 0, within the file that holds the record | never |
| `<version>` | the installed package's version | never |
| `<edition>`, `<latest>` | the edition of a clause's check that ran and the latest edition its piece declares, each a whole number from 1 | never |
| `<file>`, `<path>`, `<records file>`, `<earlier records file>`, `<records folder>`, `<slice>`, `<suppressions file>`, `<package file>`, `<config root>`, `<piece folder>`, `<location>`, `<install folder>`, `<rule page>`, `<check page>`, `<adoption guide>`, `<symptom page>` | a path, as described below | may hold a space |
| `<folders>` | paths separated by `, ` | may hold a space |
| `<folder>` | the folder that holds a `<slice>` | may hold a space |
| `<project command>` | the command that runs `hone project` for this repository: `node`, the installed command's absolute path, `project --repo` and the repository's absolute path, each path with forward slashes and in double quotes when it holds a character other than a letter, digit or one of `_ . / @ : + -` | may hold a space |
| `<prune command>` | the command that runs `hone prune-debt` for this repository: like `<project command>` with `prune-debt` in place of `project`, followed by `--base-revision` and `--forfeiture` with their values when the check was given them, each value written as a path is | may hold a space |
| `<revision>`, `<git message>` | the `--base-revision` value as given and what git said, each as a JSON string in double quotes | may hold a space |
| `<dir>` | the `--repo` value as typed | may hold a space |
| `<url>` | the module URL Hone could not resolve, as given | may hold a space |
| `<snippet>` | the source text at a finding: at most 200 characters, or the first 200 followed by `…` when it is longer | may hold a space |
| `<fix>` | what to write instead of the form a finding flags, as the clause's piece words it | may hold a space |
| `<symptom>` | a symptom's name in the installed symptom catalogue, which is also its heading's anchor on `<symptom page>`: lowercase letters, digits and hyphens | never |
| `<rule id>`, `<version 2 rule id>`, `<version 2 rule ids>` | an ESLint rule id as an inline disable writes it, or the id or ids a version 2 check has: `hone/` and the check's address, `hone/<symptom>#<check>`, character for character, with ids separated by `, ` | may hold a space |
| `<indicated>` | the names of the rules and principles the symptom may indicate, in the catalogue's order, each once, separated by `, ` | may hold a space |
| `<title>`, `<indications>`, `<breach>`, `<recipe>`, `<recipes>`, `<answers>` | the symptom's title; each case it may indicate, lowercased at its start, with ` → ` and the titles it points at separated by `, `, the cases separated by `; `; where its breach usually sits; its recipe's title, or its recipes' titles separated by `; `; and one sentence for each correct use the symptom has, then one for known debt, which every symptom takes: the situation, capitalised, then `: `, the record kind that expresses it, where it sits when the catalogue says, and in brackets that kind's format today or `no record format yet`, the sentences separated by `. ` | may hold a space |
| `<fix page>` | the page its piece names for a fix: for a clause of Hone's own rule set, a check's item, such as `rules/typescript/symptoms/branch-in-a-test/test-body.md`; for another rule set, a page in the clause's rule folder; as a path described below | may hold a space |
| `<section>` | the section of `<fix page>` that shows that form and what to write instead: lowercase letters, digits and hyphens | never |
| `<comment>`, `<script>`, `<option>`, `<source>` | the native exception's comment, the `package.json` script name and the option in it (or the whole script, when a quote in it has no partner), or where an imported record came from | may hold a space |
| `<detail>`, `<given>`, `<values>`, `<rule set>`, `<other rule set>`, `<clause with its rule set>`, `<version found>`, `<other package>`, `<range>` | text from the input, a tool or the command as typed | may hold a space |

Paths are printed with forward slashes. A path inside the `--repo` folder is printed relative to it, in the report and in load failures alike. A path outside it is printed absolute, such as `C:/Users/me/shared/rule.json` on Windows. A load failure from before `--repo` is resolved names the folder as typed (`<dir>`). A path into Hone's own package, such as a `<rule page>`, a `<fix page>`, the `<adoption guide>`, a `<piece folder>` or the `<install folder>`, is printed through the repository's `node_modules/@hailstails/hone` when that folder holds the same `package.json` as the package that is running, as it does under pnpm, which runs the package from its store under `node_modules/.pnpm`. When the repository root has no such folder, as when the package is installed only in a workspace package, installed globally or run from a source checkout, the path is printed where the running package is, by the rules above. A load failure reading the installed package's own `package.json`, which only `hone --version` reads, prints its absolute path. A path inside a `<detail>` is printed however the tool that wrote the detail printed it.

## Commands

```text
hone check --repo <dir> [--base-revision <revision>] [--report-output <full|failures-only|counts|verdict-only>] [--forfeiture <this-run|elsewhere>]
hone project --repo <dir>
hone record-debt --repo <dir> --base-revision <revision> [--leave <path>]...
hone prune-debt --repo <dir> [--base-revision <revision>] [--forfeiture <this-run|elsewhere>]
hone authorise --repo <dir> --answers <address> --file <path> --case <case> --owes <principle> --why <question>... --because <answer>... --evidence <evidence>... --root-cause <text> --root-evidence <text> --readback <text> --owner <owner>
hone split-records --repo <dir>
hone upgrade --repo <dir>
hone --help
hone --version
```

Each option is followed by its value as the next argument; a value that starts with `-` is read as a missing value. An option followed by `...` may be given more than once, one value each time; any other option given twice is `arguments-invalid`. A bare `--` where an option is expected is skipped and the options after it are still read, so `pnpm run <script> -- <options>` works whether or not the package manager passes the `--` on; a `--` where a value is expected is a missing value, like any value that starts with `-`. `--help` or `-h` after a command prints that command's help instead of running it, and `hone --help <command>` prints the same. `hone --help` and `hone --version` take nothing else after them.

`hone --help` prints:

```text
usage: hone <command> [options]

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
```

`hone check --help` prints:

```text
usage: hone check --repo <dir> [--base-revision <revision>] [--report-output <full|failures-only|counts|verdict-only>] [--forfeiture <this-run|elsewhere>]

check the repository against the disciplines it selects and print the report, ending in its verdict

options:
  --repo <dir>
      the folder that holds disciplines.json, usually the repository root
  --base-revision <revision>
      the revision the change is measured from; without it no file carve-out can be forfeited
  --report-output <full|failures-only|counts|verdict-only>
      how much of the report to print, over reportOutput in disciplines.json; full when neither is set
  --forfeiture <this-run|elsewhere>
      assess file carve-out decay in this run or leave it to another, over assessment.forfeiture in disciplines.json; this-run when neither is set
  --help, -h
      print this help

exit codes:
  0  the verdict is pass
  1  the verdict is fail
  2  a load failure: an input could not be loaded, a mechanism failed, or Hone failed unexpectedly
```

`hone project --help` prints:

```text
usage: hone project --repo <dir>

write the native configuration each selected embedded mechanism needs, printing each file as written or unchanged

options:
  --repo <dir>
      the folder that holds disciplines.json, usually the repository root
  --help, -h
      print this help

exit codes:
  0  every projection was written or already current
  2  any failure
```

`hone record-debt --help` prints:

```text
usage: hone record-debt --repo <dir> --base-revision <revision> [--leave <path>]...

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
```

`hone prune-debt --help` prints:

```text
usage: hone prune-debt --repo <dir> [--base-revision <revision>] [--forfeiture <this-run|elsewhere>]

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
```

`hone authorise --help` prints:

```text
usage: hone authorise --repo <dir> --answers <address> --file <path> --case <case> --owes <principle> --why <question>... --because <answer>... --evidence <evidence>... --root-cause <text> --root-evidence <text> --readback <text> --owner <owner>

write one authorised location to the records of a hone.config.json repository from the arguments given, with the why chain given, printing what was done

options:
  --repo <dir>
      the folder that holds hone.config.json, usually the repository root
  --answers <address>
      the symptom, or the symptom#check, the location answers, by the catalogue's names
  --file <path>
      the file the location is for, relative to --repo
  --case <case>
      the case the file is, as the cases page names it
  --owes <principle>
      the principle the case owes, as the cases page names it
  --why <question>
      one why of the chain, a question; give it, --because and --evidence once for each why, in order
  --because <answer>
      the answer to the why in the same place
  --evidence <evidence>
      what shows the answer, for the why in the same place
  --root-cause <text>
      the cause the fifth why names
  --root-evidence <text>
      the evidence that the cause still holds: what was run or read today, and what it showed
  --readback <text>
      the chain read back from the cause to the file
  --owner <owner>
      who decides whether this stays
  --help, -h
      print this help

exit codes:
  0  the location was written, was already held, or was refused with each reason printed
  2  a load failure: an input could not be loaded, the records could not be written, or Hone failed unexpectedly
```

`hone split-records --help` prints:

```text
usage: hone split-records --repo <dir>

move the exception records from discipline-exceptions.json into the discipline-exceptions folder, one file for each record kind and discipline, printing each file as written or removed

options:
  --repo <dir>
      the folder that holds disciplines.json, usually the repository root
  --help, -h
      print this help

exit codes:
  0  the records were split, or there was nothing to split
  2  a load failure: the records could not be read, placed or written, or Hone failed unexpectedly
```

`hone upgrade --help` prints:

```text
usage: hone upgrade --repo <dir>

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
```

`hone --version` prints the version of the installed package, read from its `package.json`, and exits `0`:

| Output | Line |
| --- | --- |
| `version` | `<version>` |

## The report

`hone check` prints the report's non-empty sections in this order, then the verdict line. A failing section makes the verdict `fail`; an informational or guidance section never does.

| Section | Role | What it lists |
| --- | --- | --- |
| `excluded` | informational | paths that `exclude` in `disciplines.json` leaves out |
| `notAdopted` | informational | clauses marked `not-adopted` |
| `notRun` | informational | clauses marked `not-run` |
| `editions` | informational | the edition each clause ran, for clauses whose check has more than one edition |
| `findings` | failing | each place a clause is broken |
| `exempted` | informational | findings an exception covers, with the exceptions that cover them |
| `uncovered` | failing | clauses of a selected discipline that are neither selected nor marked |
| `stale` | failing | exceptions that cover no finding |
| `forfeited` | failing | file carve-outs on files this change touched |
| `unrecorded` | failing | native exceptions with no exception record |
| `doublyHeld` | failing | files both authorised and carved out for one clause |
| `invalidRecords` | failing | exception records that cannot be applied |
| `unmeasured` | failing | what this run could not measure |
| `projectionProblems` | failing | ESLint projections that are out of date |
| `assessment` | informational | concerns this run left to another run |
| `readFirst` | guidance | where to read before changing code, for each clause with findings, and the command that removes recorded debt that is paid |

`--report-output`, or `reportOutput` in `disciplines.json`, sets how much is printed. The verdict and the exit code are the same in every output.

| Output | Prints |
| --- | --- |
| `full` | each non-empty section's heading and entries, then the verdict line |
| `failures-only` | the same without the informational sections |
| `counts` | each non-empty section's heading only, with its role after an informational or guidance section, then the verdict line |
| `verdict-only` | the verdict line |

A section heading counts its entries. In `counts`, an informational or guidance section's heading names its role. The `readFirst` count includes its leading note line when there is one.

| Line | Template |
| --- | --- |
| `heading` | `<section> (<count>)` |
| `heading` | `<section> (<count>) informational` |
| `heading` | `<section> (<count>) guidance` |
| `verdict` | `verdict: pass` |
| `verdict` | `verdict: fail` |
| `verdict` | `verdict: pass (partial assessment)` |
| `verdict` | `verdict: fail (partial assessment)` |

The verdict line reads `(partial assessment)` whenever the report has an `assessment` section.

## Report lines

Each section's entries take one of these shapes. A finding names its symptom with ` symptom: <symptom>, may indicate: <indicated>` after the snippet when the installed symptom catalogue reads one for its clause, and for `CD-27#test-body-logic`, whose test-body checks such as `branch-in-a-test#test-body` each see one symptom, for the form it flagged; a finding the catalogue reads no symptom for prints without it. A finding ends with ` fix: <fix> (<fix page>#<section>)` when its clause's piece names what to write instead of the form it flagged and the page that shows it, as `CD-27#test-body-logic` does; an exempted finding never carries either. An exempted finding repeats ` exempted by <record kind>` once for each exception that covers it. In `projectionProblems`, a `<slice>` is the `disciplines.eslint.mjs` projection file of one config root, the repository root or a folder in `eslintConfigRoots`; `unconfigured` means that root has no `eslint.config.*`.

| Section | Line |
| --- | --- |
| `excluded` | `<path>` |
| `notAdopted` | `<clause>` |
| `notRun` | `<clause> adopted, mechanism not run: enforced by review` |
| `editions` | `<clause> <mechanism> edition <edition> of <latest>` |
| `findings` | `<clause> <mechanism> <file>:<line>:<column> <snippet>` |
| `findings` | `<clause> <mechanism> <file>:<line>:<column> <snippet> fix: <fix> (<fix page>#<section>)` |
| `findings` | `<clause> <mechanism> <file>:<line>:<column> <snippet> symptom: <symptom>, may indicate: <indicated>` |
| `findings` | `<clause> <mechanism> <file>:<line>:<column> <snippet> symptom: <symptom>, may indicate: <indicated> fix: <fix> (<fix page>#<section>)` |
| `exempted` | `<clause> <mechanism> <file>:<line>:<column> <snippet> exempted by <record kind>` |
| `exempted` | `<clause> <mechanism> <file>:<line>:<column> <snippet> exempted by <record kind> imported from <source>` |
| `uncovered` | `<clause>` |
| `stale` | `<clause> <mechanism> authorised-location <file>` |
| `stale` | `<clause> <mechanism> file-carve-out <file>` |
| `stale` | `<clause> <mechanism> clause-wide-carve-out *` |
| `forfeited` | `<clause> <mechanism> file-carve-out <file>` |
| `unrecorded` | `<clause> <mechanism> ignore <file>` |
| `unrecorded` | `<clause> <mechanism> config-override <file>` |
| `unrecorded` | `<clause> <mechanism> suppression-entry <file> <suppressions file>` |
| `unrecorded` | `<clause> <mechanism> inline-disable <file>:<line> <comment>` |
| `unrecorded` | `<clause> <mechanism> inline-disable <file>:<line> <comment> names no rule and escapes every selected clause: naming the rule is the cheap fix` |
| `unrecorded` | `<clause> <mechanism> inline-rule-config <file>:<line> <comment>` |
| `unrecorded` | `<clause> <mechanism> command-line-option <package file> <script> <option> weakens the script's whole run, so no record can cover it: remove it from the script` |
| `unrecorded` | `<clause> <mechanism> command-line-option <package file> <script> <option>: <command> is not the first command of its script, so Hone cannot tell what the option does to the files under check; give <command> a script of its own, such as <invocation>` |
| `unrecorded` | `<clause> <mechanism> command-line-option <package file> <script> <option>: <wrapper> comes before <command> and is neither a package runner nor a NAME=value setting, so Hone cannot tell what the option does to the files under check; put only package runners and NAME=value settings before <command>` |
| `unrecorded` | `<clause> <mechanism> command-line-option <package file> <script> <option>: a quote in the script has no partner, so Hone cannot read what the script passes to <command> or tell what that does to the files under check; pair every quote in the script` |
| `doublyHeld` | `<clause> <mechanism> doubly-held <file>` |
| `invalidRecords` | `exceptions[<index>] clause-unparseable <detail>` |
| `invalidRecords` | `exceptions[<index>] clause-not-selected <clause>` |
| `invalidRecords` | `exceptions[<index>] clause-not-adopted <clause>` |
| `invalidRecords` | `exceptions[<index>] clause-not-run <clause>` |
| `invalidRecords` | `exceptions[<index>] file-not-repo-path <file>` |
| `invalidRecords` | `exceptions[<index>] why-chain-refused <detail>` |
| `invalidRecords` | `exceptions[<index>] evidence-refused <detail>` |
| `invalidRecords` | `exceptions[<index>] import-unverified <detail>` |
| `invalidRecords` | `exceptions[<index>] non-exemptible-clause <clause>` |
| `invalidRecords` | `exceptions[<index>] duplicate of <earlier index>` |
| `invalidRecords` | `<records file> exceptions[<index>] clause-unparseable <detail>` |
| `invalidRecords` | `<records file> exceptions[<index>] clause-not-selected <clause>` |
| `invalidRecords` | `<records file> exceptions[<index>] clause-not-adopted <clause>` |
| `invalidRecords` | `<records file> exceptions[<index>] clause-not-run <clause>` |
| `invalidRecords` | `<records file> exceptions[<index>] file-not-repo-path <file>` |
| `invalidRecords` | `<records file> exceptions[<index>] why-chain-refused <detail>` |
| `invalidRecords` | `<records file> exceptions[<index>] evidence-refused <detail>` |
| `invalidRecords` | `<records file> exceptions[<index>] import-unverified <detail>` |
| `invalidRecords` | `<records file> exceptions[<index>] non-exemptible-clause <clause>` |
| `invalidRecords` | `<records file> exceptions[<index>] duplicate of <earlier records file> exceptions[<earlier index>]` |
| `unmeasured` | `forfeiture-unmeasured no-base-revision: no --base-revision was given, so file carve-outs cannot be checked for decay; pass --base-revision with the branch's base, such as origin/main, or leave decay to another run with "assessment": { "forfeiture": "elsewhere" } in disciplines.json or --forfeiture elsewhere` |
| `unmeasured` | `forfeiture-unmeasured base-git-failed <revision>: git could not list the files changed since that revision and said <git message>; Hone needs that revision and the history back to where this branch left it, or leave decay to another run with "assessment": { "forfeiture": "elsewhere" } in disciplines.json or --forfeiture elsewhere` |
| `unmeasured` | `import-unmeasured no-base-revision: no --base-revision was given, so imported records cannot be checked against it; pass --base-revision with the branch's base, such as origin/main` |
| `unmeasured` | `import-unmeasured base-git-failed <revision>: git could not read the exception records at that revision and said <git message>; Hone needs the exception records as they were at that revision` |
| `unmeasured` | `legacy-chain-unmeasured no-base-revision: no --base-revision was given, so legacy-chain records cannot be checked against it; pass --base-revision with the branch's base, such as origin/main` |
| `unmeasured` | `legacy-chain-unmeasured base-git-failed <revision>: git could not read the exception records at that revision and said <git message>; Hone needs the exception records as they were at that revision` |
| `unmeasured` | `mechanism-not-run <mechanism> missing: disciplines.<mechanism>.mjs is not written; run <project command> and commit every disciplines.<mechanism>.mjs it writes` |
| `unmeasured` | `mechanism-not-run <mechanism> not-included: the <mechanism> configuration leaves the projection out of effect for a file under check; spread the default export of disciplines.<mechanism>.mjs, or of a package's own disciplines.<mechanism>.mjs in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), or, where a tool such as sku generates the configuration, last in the configuration the tool takes` |
| `unmeasured` | `mechanism-not-run <mechanism> not-included: the <mechanism> configuration leaves the projection out of effect for a file under check; spread the default export of disciplines.<mechanism>.mjs, or of a package's own disciplines.<mechanism>.mjs in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), or, where a tool such as sku generates the configuration, last in the configuration the tool takes; the <mechanism> lines under projectionProblems name the package slices involved` |
| `unmeasured` | `mechanism-not-run <mechanism> not-included: the <mechanism> configuration leaves the projection out of effect for a file under check; spread the default export of disciplines.<mechanism>.mjs, or of a package's own disciplines.<mechanism>.mjs in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), or, where a tool such as sku generates the configuration, last in the configuration the tool takes; <folders> hold their own disciplines.json, and nested Hone configurations are not supported yet (https://github.com/HailsTails/hone/issues/72): to govern such a folder from this repository, remove its disciplines.json and keep its records here, then run <project command>, which writes its slice` |
| `unmeasured` | `mechanism-not-run <mechanism> not-included: the <mechanism> configuration leaves the projection out of effect for a file under check; spread the default export of disciplines.<mechanism>.mjs, or of a package's own disciplines.<mechanism>.mjs in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), or, where a tool such as sku generates the configuration, last in the configuration the tool takes; the <mechanism> lines under projectionProblems name the package slices involved; <folders> hold their own disciplines.json, and nested Hone configurations are not supported yet (https://github.com/HailsTails/hone/issues/72): to govern such a folder from this repository, remove its disciplines.json and keep its records here, then run <project command>, which writes its slice` |
| `projectionProblems` | `<mechanism> out-of-date: disciplines.<mechanism>.mjs differs from what hone project writes now; run <project command> and commit every disciplines.<mechanism>.mjs it writes` |
| `projectionProblems` | `<mechanism> out-of-date <slice>: that slice differs from what hone project writes now; run <project command> and commit every disciplines.<mechanism>.mjs it writes` |
| `projectionProblems` | `<mechanism> missing <slice>: that slice is not written; run <project command> and commit every disciplines.<mechanism>.mjs it writes` |
| `projectionProblems` | `<mechanism> not-applied <slice>: the <mechanism> configuration for <folder> leaves records of that slice out of effect; spread the default export of <slice> last in that package's configuration, in place of any other projection it spreads, or, where a tool such as sku generates the configuration, last in the configuration the tool takes` |
| `projectionProblems` | `<mechanism> unconfigured <slice>: <folder> has no <mechanism> configuration file on disk, so nothing loads that slice; run the tool that generates it (for sku, sku configure) before the check` |
| `assessment` | `forfeiture elsewhere: 1 file carve-out not checked for decay in this run` |
| `assessment` | `forfeiture elsewhere: <count> file carve-outs not checked for decay in this run` |
| `readFirst` | `<symptom>: <title>. May indicate: <indications>. The breach usually sits <breach>. Recipe: <recipe>. <answers>. Read <symptom page>#<symptom>` |
| `readFirst` | `<symptom>: <title>. May indicate: <indications>. The breach usually sits <breach>. Recipes: <recipes>. <answers>. Read <symptom page>#<symptom>` |
| `readFirst` | `<symptom>: <title>. May indicate: <indications>. The breach usually sits <breach>. <answers>. Read <symptom page>#<symptom>` |
| `readFirst` | `symptom catalogue not read, so no finding names its symptom: file-unreadable <path> <detail>` |
| `readFirst` | `symptom catalogue not read, so no finding names its symptom: file-malformed <path> <detail>` |
| `readFirst` | `symptom catalogue not read, so no finding names its symptom: unsupported-version <path> <version found>` |
| `readFirst` | `Start from each rule's Spirit below. disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; <adoption guide>#5a-write-the-assessment says how to write it.` |
| `readFirst` | `disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; <adoption guide>#5a-write-the-assessment says how to write it.` |
| `readFirst` | `Start from each rule's Spirit below. disciplines.assessment.md could not be read.` |
| `readFirst` | `disciplines.assessment.md could not be read.` |
| `readFirst` | `Start from the Spirit of each rule its symptom may indicate. disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; <adoption guide>#5a-write-the-assessment says how to write it.` |
| `readFirst` | `Start from the Spirit of each rule its symptom may indicate. disciplines.assessment.md could not be read.` |
| `readFirst` | `<clause>: read the "## <clause>" section of disciplines.assessment.md, then <rule page>#spirit` |
| `readFirst` | `<clause>: read <rule page>#spirit; disciplines.assessment.md does not assess this clause` |
| `readFirst` | `<clause>: read <rule page>#spirit` |
| `readFirst` | `<clause>: read the "## <clause>" section of disciplines.assessment.md; its rule set has no rule page at <rule page>` |
| `readFirst` | `<clause>: its rule set has no rule page at <rule page>; disciplines.assessment.md does not assess this clause` |
| `readFirst` | `<clause>: its rule set has no rule page at <rule page>` |
| `readFirst` | `<clause>: read the "## <clause>" section of disciplines.assessment.md, then <check page>#fix` |
| `readFirst` | `<clause>: read <check page>#fix; disciplines.assessment.md does not assess this clause` |
| `readFirst` | `<clause>: read <check page>#fix` |
| `readFirst` | `<clause>: read the "## <clause>" section of disciplines.assessment.md, then <check page>` |
| `readFirst` | `<clause>: read <check page>; disciplines.assessment.md does not assess this clause` |
| `readFirst` | `<clause>: read <check page>` |
| `readFirst` | `<clause>: read the "## <clause>" section of disciplines.assessment.md; its rule set has no check page at <check page>` |
| `readFirst` | `<clause>: its rule set has no check page at <check page>; disciplines.assessment.md does not assess this clause` |
| `readFirst` | `<clause>: its rule set has no check page at <check page>` |
| `readFirst` | `prune-debt: 1 file carve-out under stale or forfeited still records debt that is paid; run <prune command> to remove what is paid, and commit the exception records it changes` |
| `readFirst` | `prune-debt: <count> file carve-outs under stale or forfeited still record debt that is paid; run <prune command> to remove what is paid, and commit the exception records it changes` |
| `readFirst` | `prune-debt: 1 file carve-out under stale or forfeited still records debt that is paid; run <prune command> to remove what is paid, then run <project command> and commit the exception records with every disciplines.<mechanism>.mjs it writes` |
| `readFirst` | `prune-debt: <count> file carve-outs under stale or forfeited still record debt that is paid; run <prune command> to remove what is paid, then run <project command> and commit the exception records with every disciplines.<mechanism>.mjs it writes` |

`readFirst` opens with one symptom line per symptom a finding names, in the order the findings first name them, each printed once however many findings name it. It names the symptom's cases with the rules and principles each may indicate, where the breach usually sits, its recipe or recipes when it has any, each correct use it has and the kind of record that expresses it, then known debt, which debt answers for every symptom, each with that kind's record format today. When the symptom catalogue cannot be read, `readFirst` opens instead with one line that says so and why; the findings then print as they would with no catalogue, and the verdict and exit code are those the findings decide. `readFirst` then has one clause line per clause with findings, in the order the findings first name them, then, last, one `prune-debt` line when any `file-carve-out` under `stale` or `forfeited` is one `hone prune-debt` would remove. It names `hone project` too when any of those records is for a clause whose mechanism, such as `eslint`, puts records into effect through a projection, and then names each such mechanism's projection file, joined by ` and every `. When `disciplines.assessment.md` is not written yet, or cannot be read, one note line comes after the symptom lines and before the clause lines; it starts with `Start from each rule's Spirit below.` when at least one clause line names a rule page, and otherwise with `Start from the Spirit of each rule its symptom may indicate.` when at least one names a check page. A clause of Hone's own rule set names the item of each of its checks that its findings came from, or of every check it has when a finding names none, at the item's `Fix` section when it has one; a clause of another rule set names its rule page. A clause line that names more than one page joins them with ` and `, and then names each absent page after a `;`. A clause line's first word is a clause address, which holds a `#`, followed by `:`; a note line's first word holds no `#`, which is how a tool tells them apart. A symptom line is a note line whose first word is its symptom's name followed by `:`. The `<adoption guide>` is `ADOPTING.md` in the installed package, such as `node_modules/@hailstails/hone/ADOPTING.md`. A clause line names the clause's section in `disciplines.assessment.md` when the file has one, says `does not assess this clause` when the file is there without that section, and says neither when the file is not read. [The README](../README.md#commands) says how a section is matched.

## Load failures

A run that cannot decide prints one line and exits `2`. It prints the same line in every output. The line starts with `load failure: ` and its kind; the values follow in the order shown, and any text after the values is not stable.

`hone record-debt` no longer prints `why-chains-required`: a file carve-out is debt and needs no `whyChain`, so it writes its records whatever `fileExceptionWhyChains` says. The kind keeps its line below until a major release removes it, so a tool that matches it keeps working.

| Kind | Line |
| --- | --- |
| `arguments-invalid` | `load failure: arguments-invalid <detail>` |
| `selection-absent` | `load failure: selection-absent <dir> holds no disciplines.json; give the folder that holds it, usually the repository root` |
| `install-root-unresolvable` | `load failure: install-root-unresolvable <url> <detail>` |
| `file-unreadable` | `load failure: file-unreadable <path> <detail>` |
| `file-malformed` | `load failure: file-malformed <path> <detail>` |
| `file-unwritable` | `load failure: file-unwritable <path> <detail>` |
| `records-in-both-layouts` | `load failure: records-in-both-layouts <path> <records folder>: Hone reads exception records from one layout; keep each record in one of them and remove the other` |
| `records-unsplittable` | `load failure: records-unsplittable <path> <detail>` |
| `why-chains-required` | `load failure: why-chains-required <path>: hone record-debt writes records that give only a reason, and this file requires a whyChain on every record; set "fileExceptionWhyChains": "optional" in it to accept them` |
| `unsupported-version` | `load failure: unsupported-version <path> <version found>` |
| `reserved-rule-set-name` | `load failure: reserved-rule-set-name <rule set>` |
| `rule-set-name-collision` | `load failure: rule-set-name-collision <rule set> <other rule set>` |
| `duplicate-clause` | `load failure: duplicate-clause <clause> <clause with its rule set>` |
| `unknown-rule-set` | `load failure: unknown-rule-set <rule set>` |
| `unknown-discipline` | `load failure: unknown-discipline <clause>` |
| `unknown-clause` | `load failure: unknown-clause <clause>` |
| `judgement-clause-selected` | `load failure: judgement-clause-selected <clause>` |
| `judgement-clause-listed` | `load failure: judgement-clause-listed <clause>: a judgement clause is enforced by review and is left out of clauses, adopted or not; remove it` |
| `mechanism-not-allowed` | `load failure: mechanism-not-allowed <clause> <mechanism>` |
| `runner-missing` | `load failure: runner-missing <mechanism>` |
| `runner-invalid` | `load failure: runner-invalid <mechanism> <detail>` |
| `piece-missing` | `load failure: piece-missing <clause> <mechanism>` |
| `rule-set-invalid` | `load failure: rule-set-invalid <path> <detail>` |
| `git-failed` | `load failure: git-failed <detail>` |
| `config-root-untracked` | `load failure: config-root-untracked <config root>: an eslintConfigRoots entry is a folder git tracks files under outside every excluded path, spelled exactly as git spells it; fix or remove it in disciplines.json` |
| `unexpected-error` | `load failure: unexpected-error <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> piece-invalid <piece folder> <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> file-unreadable <file> <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> file-unparseable <file> <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> tool-failed <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> plugin-conflict <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> team-config-unloadable <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> runner-invalid-output <detail>` |
| `runner-failed` | `load failure: runner-failed <mechanism> toolchain-unavailable <package> found <version found>, supported <range>: add a supported version to the devDependencies of the repository root` |
| `runner-failed` | `load failure: runner-failed <mechanism> toolchain-unavailable <package> found not installed, supported <range>: <package> is a required peer of @hailstails/hone, so this install is incomplete; add a supported version to the devDependencies of the repository root and reinstall` |
| `runner-failed` | `load failure: runner-failed <mechanism> toolchain-unavailable <package> found <version found>, supported <range>; <other package> found <version found>, supported <range>: add a supported version of each to the devDependencies of the repository root` |
| `runner-failed` | `load failure: runner-failed <mechanism> toolchain-shadowed <package> resolved from <location> inside the core install <install folder>: delete <install folder>/node_modules, then reinstall the package with the repository's package manager, so the repository's own copy is used` |

The last `toolchain-unavailable` line lists every unavailable package, separated by `; `. An `unexpected-error` is a fault in Hone, not in the repository; its `<detail>` is the error's message.

An `arguments-invalid` line says what was wrong with the command as typed. Its wording is not stable.

| Problem | Line |
| --- | --- |
| `command-missing` | `load failure: arguments-invalid hone needs a command, check, project, record-debt, prune-debt, authorise, split-records or upgrade; run hone --help for usage` |
| `command-unknown` | `load failure: arguments-invalid hone has no command "<given>"; its commands are check, project, record-debt, prune-debt, authorise, split-records and upgrade; run hone --help for usage` |
| `flag-extra` | `load failure: arguments-invalid hone <flag> takes nothing after it, not "<given>"; run hone --help for usage` |
| `argument-unexpected` | `load failure: arguments-invalid hone <command> takes options, not "<given>" on its own; give each option and its value as two arguments, as in <option> <value>; run hone <command> --help for its options` |
| `option-unknown` | `load failure: arguments-invalid hone <command> has no option "<given>"; run hone <command> --help for its options` |
| `option-joined` | `load failure: arguments-invalid give <option> and its value as two arguments, as in <option> <value>, not "<given>"` |
| `value-missing` | `load failure: arguments-invalid <option> needs a value, as in <option> <value>` |
| `option-repeated` | `load failure: arguments-invalid <option> is given more than once; give it once` |
| `option-required` | `load failure: arguments-invalid hone <command> needs --repo <dir>: the folder that holds disciplines.json, usually the repository root` |
| `choice-invalid` | `load failure: arguments-invalid <option> takes <values>, not "<given>"` |
| `option-removed` | `load failure: arguments-invalid removed: "--waived-clauses"; in clauses, mark a clause "not-run" when its mechanism does not run, or "not-adopted" when its rule does not apply; see MIGRATING.md section 12` |
| `repo-unresolvable` | `load failure: arguments-invalid --repo <dir> resolves to no absolute path` |
| `path-invalid` | `load failure: arguments-invalid <option> takes one exact file or folder inside --repo, relative to it, with forward slashes and no *, not "<given>"` |

## hone project

`hone project` prints one line per projection file it manages, and nothing when no selected mechanism needs one.

| Output | Line |
| --- | --- |
| `project` | `<path> written` |
| `project` | `<path> unchanged` |
| `project` | `<path> removed` |
| `project` | `<path> left-in-place` |

## hone record-debt

`hone record-debt` runs the check, then prints one line for each clause and file that has a finding, or an inline disable or TypeScript directive under `unrecorded`, ordered by file and then by clause. A `recorded` line is a `file-carve-out` it added to the exception records, in whichever [layout](../MIGRATING.md#16-moving-to-the-split-layout) the repository keeps them; every other line names a pair it wrote nothing for. It prints nothing when the check finds nothing to record. The `<path>` on a `left` line is the `--leave` value that covers the file. A `nested-configuration` line names a pair whose clause runs on an embedded mechanism, such as ESLint, in a file that loads the configuration in `<config folder>`, at or under the outermost `<folder>` that holds its own `disciplines.json`. The projection never reaches that configuration, so a record there would leave the projection out of effect and fail the next check.

| Output | Line |
| --- | --- |
| `record-debt` | `<clause> recorded <file>` |
| `record-debt` | `<clause> already-recorded <file>: <records file> already holds a record on this clause and file; the check says why it does not hold` |
| `record-debt` | `<clause> left <file>: under --leave <path>; record it as an authorised-location with its own reason, or fix it` |
| `record-debt` | `<clause> new-file <file>: the base revision does not hold this file, so its debt was not inherited; fix it, or record it with its own reason` |
| `record-debt` | `<clause> refused <file>: the clause's discipline refuses exceptions; fix it` |
| `record-debt` | `<clause> nested-configuration <file>: the file loads the <mechanism> configuration in <config folder>, and <folder> holds its own disciplines.json; nested Hone configurations are not supported yet (https://github.com/HailsTails/hone/issues/72), so the <mechanism> projection cannot put a record on this file into effect; fix it, or govern <folder> from this repository by removing <folder>/disciplines.json, then run record-debt again` |

## hone prune-debt

`hone prune-debt` runs the check with the `--base-revision` and `--forfeiture` it is given, then removes from the exception records each `file-carve-out` the check lists under `stale` or `forfeited` whose file no longer exists or whose clause and file its mechanism reported as `measured`, unless its clause and file still hold a finding that no record answers, a finding that only debt exempts, or any native exception, recorded or not. A finding an `authorised-location` in force exempts is answered and does not keep the record; a `clause-wide-carve-out` is not an answer. An imported `authorised-location` or one with a legacy why-chain answers nothing on a run whose exception baseline is unmeasured, since that run accepted it without judging it at the base revision, so an unmeasured baseline removes nothing on such an answer. A `file-carve-out` in force beside an `authorised-location` on the same clause and file is listed under `doublyHeld`, not `stale` or `forfeited`, so the command removes neither. It works in whichever [layout](../MIGRATING.md#16-moving-to-the-split-layout) the repository keeps the records in, and prints one line for each clause and file it removed, ordered by file and then by clause. It leaves every other record for a person: a stale or forfeited `file-carve-out` on a file that still exists and that its mechanism did not measure, such as a file the mechanism skips, and an `authorised-location` or `clause-wide-carve-out` under `stale`. It prints nothing when it removed none. It does not write the projection: with an `eslint` clause, run `hone project` after it, as the `readFirst` line says. The text of every other record in a file it changes is kept byte for byte. In the split layout, a rule's file left with no records is deleted; a single `discipline-exceptions.json` left with none holds an empty list.

| Output | Line |
| --- | --- |
| `prune-debt` | `<clause> removed <file>` |

## hone split-records

`hone split-records` moves a repository's exception records from `discipline-exceptions.json` into the `discipline-exceptions` folder. It prints a `written` line for each file it writes, in path order, then a `removed` line for `discipline-exceptions.json`. When the records are already split, or `discipline-exceptions.json` is absent or holds no records, it prints one line, changes nothing and exits `0`. A records file that holds a record whose clause names no discipline, or keys other than `version` and `exceptions`, is `records-unsplittable`, and nothing is written.

| Output | Line |
| --- | --- |
| `split-records` | `<path> written` |
| `split-records` | `<path> removed` |
| `split-records` | `<path> already holds the records split: nothing to split` |
| `split-records` | `<path> holds no records: nothing to split` |

## hone upgrade

`hone upgrade` moves a version 1 repository to version 2. It writes `hone.config.json`, the `hone-records` folder and the version 2 projections, one for the repository root and one for each package folder version 1 projected into, rewrites each team ESLint config that imports a version 1 projection to import the version 2 projection in its own folder, carries `eslintConfigRoots` over, runs version 1 and version 2 over the same repository, and removes the version 1 files only when both report the same thing. A repository that is already on version 2 prints one line and exits `0`.

On success it prints `upgraded to version 2`, then a `wrote` line for each file it wrote, a `rewrote` line for each team config it rewrote, and a `removed` line for each version 1 file and folder it removed, and exits `0`. The version 1 files it removes are `disciplines.json`, every version 1 projection, and every `.json` file and folder it finds in `discipline-exceptions.json` or the `discipline-exceptions` folder, whether or not it holds a record. The `wrote`, `rewrote` and `removed` lines print a path inside `--repo` relative to it; the lines of a refusal print the paths as the files are, absolute.

A refusal prints `upgrade refused:`, then one or more lines saying what to do, then either `Nothing was changed.` or the files that could not be put back, and exits `1`. A refusal before anything is written never changes the repository. A refusal after files were written puts them back. A file that could not be put back is named with what to do: a file or folder the upgrade created is deleted by hand, and a file it replaced is restored from version control. A refusal that names a fault in Hone prints where to report it. The upgrade asks version 1 which projections it writes by running version 1's own `project` once, after version 1's run has reported every projection current, so a current projection that no config root owns any more is removed, as version 1's own `project` removes it. Version 1's own `project` is expected to change nothing but that removal: if it rewrites a projection, the upgrade refuses and names the file, since the run it measured was made before, and if it fails, the upgrade cannot know what it did before failing, so that refusal prints `version 1's own project may have changed files before it failed; check version control for what it changed.` in place of `Nothing was changed.`. A refusal that comes after that removal lists each file removed under `version 1's own project removed these files, and the upgrade does not put them back; restore them from version control:`, apart from the files the upgrade itself could not put back, and does not print `Nothing was changed.`; a success lists it among the version 1 files removed.

The records the upgrade carries over follow the `forfeiture` setting afterwards, as debt does. Its own proof never receives a base revision. A later `hone check` with no `--base-revision` leaves them to the run that has a base under `"forfeiture": "elsewhere"`, printing a `carried standing elsewhere` line in `assessment`, and fails with `import-unmeasured` under the default `this-run`.

When version 2 is in place but a version 1 file could not be removed, it prints `upgrade incomplete:`, the files it wrote, the file it could not remove, and every version 1 file still present, which it asks you to delete by hand, then commit, and exits `3`. Nothing is rolled back; the version 2 files stay. While `disciplines.json` is still beside `hone.config.json`, every `hone` command stops with `settings-in-both-versions`.

| Output | Line |
| --- | --- |
| `upgrade` | `upgrade refused:` |
| `upgrade` | `upgrade incomplete:` |
| `upgrade` | `Nothing was changed.` |
| `upgrade` | `upgraded to version 2` |
| `upgrade` | `wrote <path>` |
| `upgrade` | `rewrote <path>` |
| `upgrade` | `removed <path>` |
| `upgrade` | `already on version 2; nothing to upgrade` |
| `upgrade` | `This is a fault in hone, not in your repository. Report it at <issues page>, with this output.` |
| `upgrade` | `version 1's own run could not be made (<detail>). Run hone check and fix its load failure first.` |
| `upgrade` | `version 1's run failed (<detail>). Run hone check and fix its load failure first.` |
| `upgrade` | `version 1's own project failed (<detail>). Run hone project with your version 1 release, fix what it reports, then run the upgrade again.` |
| `upgrade` | `version 1's own project may have changed files before it failed; check version control for what it changed.` |
| `upgrade` | `version 1's own project rewrote <files>, which the upgrade had already measured. Commit what it wrote, then run the upgrade again.` |
| `upgrade` | `version 1's files could not be read (<detail>). Run hone check and fix its load failure first.` |
| `upgrade` | `a finding of <clause> in <file> names no check of version 2. Report it at <issues page>.` |
| `upgrade` | `<clause> in <file> is held by both a file carve-out and an authorised location. Remove one of them first, then run the upgrade again.` |
| `upgrade` | `the carve-out for <clause> in <file> was given no answer. This is a fault in hone, not in your repository. Report it at <issues page>, with this output.` |
| `upgrade` | `the authorised location for <clause> in <file> was given no answer. This is a fault in hone, not in your repository. Report it at <issues page>, with this output.` |
| `upgrade` | `<clause> has no version 2 check to run it, and version 2 does not carry the clauses of a version 1 team rule set. Remove it from disciplines.json to upgrade without it, or stay on version 1.` |
| `upgrade` | `<check> has no engine on the <mechanism> mechanism. This is a fault in hone, not in your repository. Report it at <issues page>, with this output.` |
| `upgrade` | `<check> could run on <engines> through the <mechanism> mechanism; the upgrade cannot choose. This is a fault in hone, not in your repository. Report it at <issues page>, with this output.` |
| `upgrade` | `the file carve-out for <clause> in <file> answers no finding. Remove it, or fix the file it names, then run the upgrade again.` |
| `upgrade` | `the file carve-out for <clause> in <file> answers only a suppression. Remove it, or fix the file it names, then run the upgrade again.` |
| `upgrade` | `<clause> carries a clause-wide carve-out, which version 2 has no record for. Replace it with file carve-outs first.` |
| `upgrade` | `<name> is not a name version 2 can file records under. This is a fault in hone, not in your repository. Report it at <issues page>, with this output.` |
| `upgrade` | `version 2's projection could not be made (<detail>). Fix what it names, then run the upgrade again.` |
| `upgrade` | `version 2 cannot run this repository yet (<detail>). Do what it names, or stay on version 1 until version 2 runs it, then run the upgrade again.` |
| `upgrade` | `the version 1 projection <projection> has no version 2 projection to take its place, since version 2 runs no lint config in <folder>. Remove it and its import in <config file>, then run the upgrade again.` |
| `upgrade` | `version 2 would project <file>, but version 1 has no projection in <folder>. With your version 1 release, run hone project and import what it writes in the lint config of <folder>, commit, then run the upgrade again.` |
| `upgrade` | `the version 1 projection <projection> belongs to no config root and is out of date. Delete it or restore its config root, commit, then run the upgrade again.` |
| `upgrade` | `the version 1 projection <projection> is <state>. Run hone project with your version 1 release, commit what it writes, then run the upgrade again.` |
| `upgrade` | `the version 1 projection <projection> is <state>. Run hone check with your version 1 release, fix what it reports, then run the upgrade again.` |
| `upgrade` | `the version 2 records would reach beyond the version 1 entries: <records>.` |
| `upgrade` | `<config file> holds no static default import of <projection>. Change its import of it to the form import projection from "<specifier>", then run the upgrade again.` |
| `upgrade` | `<config file> imports the version 1 projection <count> times. Import it once.` |
| `upgrade` | `<config file> names a version 1 projection outside the imports the upgrade rewrites, or imports one version 1 did not write. Remove the other mention or import, then run the upgrade again.` |
| `upgrade` | `version 1 already reports <clauses> as uncovered. Select or mark each of them in disciplines.json, then run the upgrade again.` |
| `upgrade` | `<file> cannot be placed in the repository. This is a fault in hone, not in your repository. Report it at <issues page>, with this output.` |
| `upgrade` | `the version 1 records file <path> is outside <root>. This is a fault in hone, not in your repository. Report it at <issues page>, with this output.` |
| `upgrade` | `<path> already exists. Move it aside, then run the upgrade again.` |
| `upgrade` | `<path> could not be read to be replaced (<detail>). Make it readable, then run the upgrade again.` |
| `upgrade` | `<path> could not be created (<detail>). Fix what the detail names, then run the upgrade again.` |
| `upgrade` | `<path> could not be written (<detail>). Fix what the detail names, then run the upgrade again.` |
| `upgrade` | `version 2's run failed (<detail>). This is a fault in hone, not in your repository. Report it at <issues page>, with this output.` |
| `upgrade` | `version 2 does not report what version 1 reported:` |
| `upgrade` | `  <section>:` |
| `upgrade` | `    only before: <before>` |
| `upgrade` | `    only after: <after>` |
| `upgrade` | `these inline directives name a version 1 rule id, which version 2 names differently:` |
| `upgrade` | `  <file>:<line> <rule id>: write <version 2 rule id>` |
| `upgrade` | `  <file>:<line> <rule id>: write each of <version 2 rule ids>` |
| `upgrade` | `Replace each version 1 id with the version 2 id shown, then run the upgrade again.` |
| `upgrade` | `these inline directives name a hone rule id that version 2 has no check under:` |
| `upgrade` | `  <file>:<line> <rule id>` |
| `upgrade` | `Fix each one to name a check of version 2, or remove it, then run the upgrade again.` |
| `upgrade` | `version 1's own project removed these files, and the upgrade does not put them back; restore them from version control:` |
| `upgrade` | `  <removed path>` |
| `upgrade` | `These files could not be put back; put them right by hand:` |
| `upgrade` | `  delete <unrestored path> (<unrestored detail>)` |
| `upgrade` | `  delete the empty folder <unrestored path> (<unrestored detail>)` |
| `upgrade` | `  restore <unrestored path> from version control (<unrestored detail>)` |
| `upgrade` | `the version 1 records are invalid; fix them first:` |
| `upgrade` | `<records file> entry <index>: <problem>` |
| `upgrade` | `a version 1 record in <records file> is not JSON. Fix it first.` |
| `upgrade` | `no file imports <projection> with a static default import. Change the ESLint config next to it to import it in the form import projection from "<specifier>", then run the upgrade again.` |
| `upgrade` | `<config file> could not be read (<detail>). Make it readable, then run the upgrade again.` |
| `upgrade` | `version 2 is in place (written: <written>; replaced: <replaced>), but <removal path> could not be removed (<detail>).` |
| `upgrade` | `version 2 is in place (written: <written>), but <removal path> is outside <root>.` |
| `upgrade` | `Delete these version 1 files by hand, then commit:` |
| `upgrade` | `  <remaining path>` |

# Version 2

Everything above this heading is what the installed `hone` prints today, on a repository that keeps `disciplines.json`. This part lists what a version 2 run prints: the report of `hone check` on a repository that keeps `hone.config.json` and `hone-records/`. A repository that keeps `disciplines.json` gets the report described above; `hone upgrade` moves it to `hone.config.json` and `hone-records/`, and from then on `hone check` prints the report described here. The same test that holds the tables above to what 1.x prints holds the tables in this part to what the version 2 report prints, reading this part on its own.

The streams, exit codes, output modes, verdict lines and heading lines are the same as in 1.x. What changes is the vocabulary: a check address `<symptom>#<check>` where 1.x printed a clause address, an engine where it printed a mechanism, and the five record kinds where it printed exception records.

## What a tool can parse in version 2

A tool can rely on these from 2.0.0, and a change to any of them is a major release:

- the section names, their order and roles, the heading and count lines, and the four verdict lines;
- in each line below, the fixed words and values up to the first value that may hold a space, and the single spaces between them. For a finding, that is its check address and engine; for a record, what it holds, its kind and the start of its site; for a refused, noted or carried record, its records file and index, then the refusal's kind, the note's kind or the record's standing.

A line of `findings`, `answered` or `unrecorded` leads with either a check or a clause. A tool tells them apart by the first field: a check address is lower-case catalogue names joined by `#` (`claimed-type#cast-expressions`), and a clause address holds an upper-case discipline id before its `#` (`CD-27#test-body-logic`, `acme/AC-1#no-moment`). After a check address, the second field is the engine that ran it. After a clause address, it is the mechanism id that raised the finding, since the symptom catalogue gives that clause no check.

A `<records file>` is one field: it is printed bare when its path holds no space, double quote or line break, and as a JSON string in double quotes when it does. A records file whose name is not a catalogue name, such as `hone-records/debt/my notes.json`, is still read, and its records are refused as `misplaced`, so its path can lead a `refused` line.

A record's ` carried` and its ` note: ` words come after its `<file>` or `<module>`, which may hold a space, so they are for a person. A tool reads the same facts from the `carried` and `record-notes` sections, which lead with the record's records file and index. A tool tells debt refused for a check its symptom does not have from an authorised location kept with a note for it by the section and the third field: the refusal is under `refused` with `unknown-check` as its third field, and the note is under `record-notes` with `unknown-check:`, ending in a colon.

These are not stable: the words after the `:` that ends an `unmeasured` or `projection-problems` line's leading fields, the `symptoms` lines, the `settings-notes` lines, the words of a ` note: ` on a record and of a `record-notes` line after its kind, the words of a refusal after its kind's values, the words after a record's site in `stale`, `forfeited` and `paid`, and a finding's `<fix>`.

As in 1.x, a minor release may add a section, a line form or a value, and a tool passes over a section heading or line it does not know. Removing or renaming a section or a line form, or changing a stable part, is a major release.

## Values in version 2

| Value | Printed as | Space |
| --- | --- | --- |
| `<check>` | a check address, `<symptom>#<check>`, such as `date-used-directly#clock-sources`; for a finding or native exception of a clause the symptom catalogue gives no check, such as a team rule set's, the clause address; in a load failure, the check as `hone.config.json` lists it, led by its rule set and `/` when it has one, or the clause address when the failure is in the rule set's own files | never in the report; may hold a space in a load failure |
| `<engine>` | the engine that ran the check, such as `walker` or `eslint`; beside a clause address, or in a load failure when the catalogue names no engine for it, the mechanism id | never |
| `<symptom>`, `<recipe>`, `<case name>` | a name in the symptom catalogue | never |
| `<section>` | in a finding, the section of its fix page, as in 1.x; in an upgrade refusal, a compared section of the two reports, always written in version 2's style: `excluded`, `findings`, `answered`, `unrecorded`, `misnamed`, `paid`, `stale`, `forfeited`, `doubly-held`, `invalid-records`, `not-adopted`, `not-run`, `editions`, `unmeasured`, `projection-problems`, `assessment` or `verdict` | never |
| `<check name>` | the check an authorised location names that its symptom does not have, as the record writes it | never |
| `<outside party>`, `<dependency>` | a boundary record's outside party, such as `runtime:clock`, `node:fs` or `uuid/v4`, and a dependency record's package name | never |
| `<records file>` | a records file under `hone-records/`, bare, or as a JSON string in double quotes when its path holds a space, a double quote or a line break | never outside a JSON string |
| `<belongs in>` | the records file a record belongs in, named for its kind and symptom or recipe | never |
| `<index>`, `<earlier index>` | a record's place in its records file's `records`, counting from 0; `<earlier index>` is the place of the record a duplicate repeats | never |
| `<standing>` | `established`, a carried record unchanged against the base revision, or `unjudged`, one this run could not compare | never |
| `<convention>` | a key of `hone.config.json` that no check reads yet: `generated` or `layers` | never |
| `<path>`, `<file>`, `<module>`, `<slice>`, `<folder>`, `<folders>`, `<fix page>`, `<symptom page>` | a path, printed as in 1.x; in the report `<path>` is one that `exclude` leaves out, and in a load failure it is the file that failed | may hold a space |
| `<snippet>`, `<fix>`, `<indicated>`, `<title>`, `<indications>`, `<breach>`, `<recipe title>`, `<recipe titles>`, `<answers>`, `<comment>`, `<script>`, `<option>`, `<command>`, `<invocation>`, `<wrapper>`, `<suppressions file>`, `<package file>`, `<project command>`, `<count>`, `<edition>`, `<latest>`, `<line>`, `<column>` | as in 1.x | as in 1.x |
| `<prune command>` | the command that removes paid, stale and forfeited debt, printed as `<project command>` is | may hold a space |
| `<case>`, `<owes>`, `<given>`, `<reason>`, `<revision>`, `<git message>` | text as written in a record, the command or git, as a JSON string in double quotes | may hold a space |
| `<issues>` | each problem the record's form has, as its key's path (`record` for the record itself) then `: ` and what is wrong, separated by `; ` | may hold a space |
| `<lacks>` | the keys a carried record lacks, separated by `, ` | may hold a space |
| `<dir>`, `<detail>`, `<url>`, `<version found>`, `<rule set>`, `<other rule set>`, `<config root>`, `<piece folder>`, `<package>`, `<other package>`, `<range>`, `<location>`, `<install folder>` | as in 1.x | as in 1.x |
| `<settings key>` | `checks` or `checkSettings`, the key that lists a check twice | never |
| `<check with its rule set>` | the check's address led by its rule set and `/`, such as `hone/claimed-type#cast-expressions`, as `hone.config.json` lists it | may hold a space |
| `<engines>` | the engines a check runs on, separated by ` or ` | never |
| `<other check>` | a further check address, as `hone.config.json` lists it | may hold a space |
| `<other checks>` | the further checks of the same rule, built from the catalogue, separated by a space | never |
| `<state>` | `not-run` or `not-adopted` | never |
| `<records folder>`, `<other records file>` | a folder or further records file under `hone-records/`, printed as `<records file>` is | never outside a JSON string |
| `<name>` | a file name no repository path can hold, as a JSON string in double quotes | may hold a space |
| `<document issues>` | each problem a refused records document has, as its key's path (`document` for the document itself) then `: ` and what is wrong, separated by `, ` | may hold a space |
| `<upgrade command>` | the command that rewrites version 1 files as version 2, printed as `<project command>` is | may hold a space |

## The version 2 report

`hone check` prints the report's non-empty sections in this order, then the verdict line. A failing section makes the verdict `fail`; a next-step, informational or guidance section never does, so paid debt, a note, an answered finding, a check available to list, a carried record or a symptom never fails a run. `actionable` prints the failing, next-step and guidance sections and leaves out the informational ones, so a hook that prints failures only still shows paid debt and the command that removes it. A passing run can therefore print a `paid` section under `actionable`, so a hook tells pass from fail by the exit code, not by whether anything was printed.

| Section | Role | What it lists |
| --- | --- | --- |
| `excluded` | informational | paths that `exclude` in `hone.config.json` leaves out |
| `not-adopted` | informational | checks marked `not-adopted` |
| `not-run` | informational | checks marked `not-run` |
| `editions` | informational | the edition each check ran, for checks with more than one edition |
| `findings` | failing | each place a check sees its symptom, unanswered |
| `answered` | informational | findings a record answers, with the records that answer them |
| `available` | informational | checks no setting lists whose symptom a listed check sees, offered to list |
| `stale` | failing | records that answer no finding and hold no native exception |
| `forfeited` | failing | debt on files this change touched |
| `unrecorded` | failing | native exceptions no record holds |
| `misnamed` | failing | inline disables that name a version 1 rule id or an id no check of this run has, which suppress nothing |
| `paid` | next-step | debt another record answers in place of, for a finding this run raised, with the records that answer and the command that removes the debt |
| `refused` | failing | records that cannot be read or applied |
| `unmeasured` | failing | what this run could not measure |
| `projection-problems` | failing | ESLint projections that are out of date |
| `assessment` | informational | concerns this run left to another run |
| `settings-notes` | informational | what `hone.config.json` declares that no check reads yet |
| `record-notes` | informational | every note on a record, by its records file and index, whether or not the record answers a finding |
| `carried` | informational | records carried from version 1 word for word, with what each lacks |
| `symptoms` | guidance | one note for each symptom the findings name |

The outputs are `full`, `actionable`, `counts` and `verdict-only`; `actionable` is the output version 1 called `failures-only`, and `hone upgrade` writes a version 1 `failures-only` as `actionable`. A version 2 settings file or `--report-output` that says `failures-only` is refused like any other word that is not an output.

| Line | Template |
| --- | --- |
| `heading` | `<section> (<count>)` |
| `heading` | `<section> (<count>) next-step` |
| `heading` | `<section> (<count>) informational` |
| `heading` | `<section> (<count>) guidance` |
| `verdict` | `verdict: pass` |
| `verdict` | `verdict: fail` |
| `verdict` | `verdict: pass (partial assessment)` |
| `verdict` | `verdict: fail (partial assessment)` |

## Version 2 report lines

A finding names what its symptom may indicate after the snippet, and ends with ` fix: <fix> (<fix page>#<section>)` when its check names what to write instead. A finding of a clause the catalogue gives no check prints its clause address and mechanism in place of `<check> <engine>`, and names no indication. An answered finding repeats ` answered by <reference>` once for each record that answers it, and so does paid debt, for each record that answers in its place. Debt is paid when every finding it held in this run was answered in its place. Pruning paid debt removes the record whole, so a later finding of another check at that file is a new finding. A stale record prints as its `<subject>`; stale debt then ends with the command that removes it, and forfeited debt with what to do before removing it. A native exception prints one line for each check of its clause that runs on its engine. An inline disable that names a rule id of the tool's own `hone/` namespace which no check of this run has suppresses nothing, and the finding it was written over is still reported; it prints under `misnamed` as `version-1-id` when the id is one a version 1 piece names, and as `names-no-check` for any other id, and fails the run until the disable names the check's own id, `hone/<symptom>#<check>`.

| Section | Line |
| --- | --- |
| `excluded` | `<path>` |
| `not-adopted` | `<check>` |
| `not-run` | `<check> adopted, engine not run: enforced by review` |
| `editions` | `<check> <engine> edition <edition> of <latest>` |
| `findings` | `<check> <engine> <file>:<line>:<column> <snippet> may indicate: <indicated>` |
| `findings` | `<check> <engine> <file>:<line>:<column> <snippet> may indicate: <indicated> fix: <fix> (<fix page>#<section>)` |
| `findings` | `<check> <engine> <file>:<line>:<column> <snippet>` |
| `findings` | `<check> <engine> <file>:<line>:<column> <snippet> fix: <fix> (<fix page>#<section>)` |
| `answered` | `<check> <engine> <file>:<line>:<column> <snippet> answered by <reference>` |
| `available` | `<check>` |
| `stale` | `<subject>` |
| `stale` | `<subject>; its file is no longer in the repository` |
| `stale` | `<subject>; its file is excluded by the settings, so nothing there was checked` |
| `stale` | `<subject>; nothing it holds is found: run <prune command> to remove it` |
| `stale` | `<subject>; its file is no longer in the repository: run <prune command> to remove it` |
| `stale` | `<subject>; its file is excluded by the settings, so nothing there was checked: run <prune command> to remove it` |
| `forfeited` | `<subject>; this change touched its file, so it no longer answers: fix what it held, then run <prune command> to remove it` |
| `unrecorded` | `<check> <engine> ignore <file>` |
| `unrecorded` | `<check> <engine> config-override <file>` |
| `unrecorded` | `<check> <engine> suppression-entry <file> <suppressions file>` |
| `unrecorded` | `<check> <engine> inline-disable <file>:<line> <comment>` |
| `unrecorded` | `<check> <engine> inline-disable <file>:<line> <comment> names no rule and escapes every selected check: naming the rule is the cheap fix` |
| `unrecorded` | `<check> <engine> inline-rule-config <file>:<line> <comment>` |
| `unrecorded` | `<check> <engine> command-line-option <package file> <script> <option> weakens the script's whole run, so no record can cover it: remove it from the script` |
| `unrecorded` | `<check> <engine> command-line-option <package file> <script> <option>: <command> is not the first command of its script, so Hone cannot tell what the option does to the files under check; give <command> a script of its own, such as <invocation>` |
| `unrecorded` | `<check> <engine> command-line-option <package file> <script> <option>: <wrapper> comes before <command> and is neither a package runner nor a NAME=value setting, so Hone cannot tell what the option does to the files under check; put only package runners and NAME=value settings before <command>` |
| `unrecorded` | `<check> <engine> command-line-option <package file> <script> <option>: a quote in the script has no partner, so Hone cannot read what the script passes to <command> or tell what that does to the files under check; pair every quote in the script` |
| `misnamed` | `<file>:<line> version-1-id <rule id> write <version 2 rule id> <comment>` |
| `misnamed` | `<file>:<line> version-1-id <rule id> write each of <version 2 rule ids> <comment>` |
| `misnamed` | `<file>:<line> names-no-check <rule id> <comment>` |
| `paid` | `<subject> answered by <reference>; run <prune command> to remove the paid debt` |
| `refused` | `<records file> records[<index>] form-refused <issues>` |
| `refused` | `<records file> records[<index>] unknown-symptom <given>` |
| `refused` | `<records file> records[<index>] unknown-check <given> of <symptom>` |
| `refused` | `<records file> records[<index>] unknown-recipe <given>` |
| `refused` | `<records file> records[<index>] recipe-reason-not-the-catalogues <recipe>: the catalogue gives its reason as <reason>` |
| `refused` | `<records file> records[<index>] named-ban <dependency>` |
| `refused` | `<records file> records[<index>] unknown-runtime-facility <outside party>` |
| `refused` | `<records file> records[<index>] misplaced <belongs in>` |
| `refused` | `<records file> records[<index>] not-a-records-name <given>` |
| `refused` | `<records file> records[<index>] carried-changed-since-base` |
| `refused` | `<records file> records[<index>] duplicate of <records file> records[<earlier index>]` |
| `unmeasured` | `forfeiture-unmeasured no-base-revision: no --base-revision was given, so debt cannot be checked for forfeiture; pass --base-revision with the branch's base, such as origin/main, or leave forfeiture to another run with "forfeiture": "elsewhere" in hone.config.json or --forfeiture elsewhere` |
| `unmeasured` | `forfeiture-unmeasured base-git-failed <revision>: git could not list the files changed since that revision and said <git message>; Hone needs that revision and the history back to where this branch left it, or leave forfeiture to another run with "forfeiture": "elsewhere" in hone.config.json or --forfeiture elsewhere` |
| `unmeasured` | `import-unmeasured no-base-revision: no --base-revision was given, so carried records cannot be checked against it; pass --base-revision with the branch's base, such as origin/main, or leave forfeiture to another run with "forfeiture": "elsewhere" in hone.config.json or --forfeiture elsewhere` |
| `unmeasured` | `import-unmeasured base-git-failed <revision>: git could not read hone-records at that revision and said <git message>; Hone needs hone-records as it was at that revision` |
| `unmeasured` | `engine-not-run <engine> missing: hone.<engine>.mjs is not written; run <project command> and commit every file it writes` |
| `unmeasured` | `engine-not-run <engine> not-included: the <engine> configuration leaves the projection out of effect for a file under check; spread the default export of hone.<engine>.mjs, or of a package's own hone.<engine>.mjs in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), or, where a tool such as sku generates the configuration, last in the configuration the tool takes` |
| `unmeasured` | `engine-not-run <engine> not-included: the <engine> configuration leaves the projection out of effect for a file under check; spread the default export of hone.<engine>.mjs, or of a package's own hone.<engine>.mjs in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), or, where a tool such as sku generates the configuration, last in the configuration the tool takes; the <engine> lines under projection-problems name the package slices involved` |
| `unmeasured` | `engine-not-run <engine> not-included: the <engine> configuration leaves the projection out of effect for a file under check; spread the default export of hone.<engine>.mjs, or of a package's own hone.<engine>.mjs in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), or, where a tool such as sku generates the configuration, last in the configuration the tool takes; <folders> hold their own hone.config.json, and nested Hone configurations are not supported yet (https://github.com/HailsTails/hone/issues/72): to govern such a folder from this repository, remove its hone.config.json and keep its records here, then run <project command>, which writes its slice` |
| `unmeasured` | `engine-not-run <engine> not-included: the <engine> configuration leaves the projection out of effect for a file under check; spread the default export of hone.<engine>.mjs, or of a package's own hone.<engine>.mjs in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), or, where a tool such as sku generates the configuration, last in the configuration the tool takes; the <engine> lines under projection-problems name the package slices involved; <folders> hold their own hone.config.json, and nested Hone configurations are not supported yet (https://github.com/HailsTails/hone/issues/72): to govern such a folder from this repository, remove its hone.config.json and keep its records here, then run <project command>, which writes its slice` |
| `unmeasured` | `engine-not-run <engine> measured-nothing: the <engine> engine measured no file in this run, so the records its checks answer were not judged, neither kept as answering nor removed as stale; the <engine> lines under projection-problems name what to fix` |
| `unmeasured` | `engine-not-run <engine> measured-nothing: the <engine> engine measured no file in this run, so the records its checks answer were not judged, neither kept as answering nor removed as stale; check that the <engine> configuration lints the files under check` |
| `projection-problems` | `<engine> out-of-date: hone.<engine>.mjs differs from what hone project writes now; run <project command> and commit every file it writes` |
| `projection-problems` | `<engine> out-of-date <slice>: that slice differs from what hone project writes now; run <project command> and commit every file it writes` |
| `projection-problems` | `<engine> missing <slice>: that slice is not written; run <project command> and commit every file it writes` |
| `projection-problems` | `<engine> unconfigured <slice>: <folder> has no <engine> configuration file on disk, so nothing loads that slice; run the tool that generates it (for sku, sku configure) before the check` |
| `assessment` | `forfeiture elsewhere: 1 debt record not checked for forfeiture in this run` |
| `assessment` | `forfeiture elsewhere: <count> debt records not checked for forfeiture in this run` |
| `assessment` | `carried standing elsewhere: 1 carried record not checked against the base in this run` |
| `assessment` | `carried standing elsewhere: <count> carried records not checked against the base in this run` |
| `settings-notes` | `<convention> is declared; no check reads it yet` |
| `record-notes` | `<records file> records[<index>] unknown-check: the catalogue has no check <given> of <symptom>` |
| `record-notes` | `<records file> records[<index>] unknown-case: the catalogue has no case <case>, owing <owes>` |
| `record-notes` | `<records file> records[<index>] owes-not-owed: <case name> does not owe <owes>` |
| `carried` | `<records file> records[<index>] <standing> lacks <lacks>` |
| `carried` | `<records file> records[<index>] <standing>` |
| `symptoms` | `<symptom>: <title>. May indicate: <indications>. The breach usually sits <breach>. Recipe: <recipe title>. <answers>. Read <symptom page>#<symptom>` |
| `symptoms` | `<symptom>: <title>. May indicate: <indications>. The breach usually sits <breach>. Recipes: <recipe titles>. <answers>. Read <symptom page>#<symptom>` |
| `symptoms` | `<symptom>: <title>. May indicate: <indications>. The breach usually sits <breach>. <answers>. Read <symptom page>#<symptom>` |

In `symptoms`, `<answers>` is one sentence for each correct use the symptom has, then one for known debt, which every symptom takes: the situation, capitalised, then `: `, the record kind that expresses it, and where it sits when the catalogue says.

A run that leaves forfeiture to another run, with `"forfeiture": "elsewhere"` in `hone.config.json` or `--forfeiture elsewhere`, leaves every judgement that needs a base to the run that has one. Debt is not checked for forfeiture, and a record carried over from version 1 is not checked against the base: when no `--base-revision` was given, the run prints one `carried standing elsewhere` line in `assessment` with how many carried records it left, and neither `forfeiture-unmeasured` nor `import-unmeasured` is printed. With a base revision, a carried record is judged in the run whatever the setting says, and a base revision that was given and cannot be read prints `import-unmeasured base-git-failed` and fails under either setting, since `elsewhere` excuses only a base that was not given. If no run is ever given a base revision, carried records are never judged, the same trade forfeiture makes under `elsewhere`. A run that assesses forfeiture in this run, the default, prints `import-unmeasured` and fails when it holds a carried record and no base revision was given. A check is never made against the commit when no base is given.

## Version 2 record subjects and references

A record is named by its `<subject>` in `stale`, `forfeited` and `paid`, and by its `<reference>` beside a finding it answers or a debt it answers in place of. A debt or authorised location that names one check of its symptom leads its subject with that check's address. An authorised location whose check, case or owes the catalogue does not list prints a ` note: ` for each of them, wherever it is named, and each note is listed again under `record-notes`. The record is still read and never refused for it, and the note never changes the verdict. An authorised location whose check its symptom does not have answers nothing until its check is corrected; it does not widen to the whole symptom. A record is listed under `stale` when nothing credits it and any one of three things holds: every check it reaches that a run selected was measured, where the record reaches it, by an engine of that check; or its place, the file or module it names, is no longer in the repository; or the settings exclude its place, which leaves the place out of what any engine checks. The line says which holds: a measured record prints `nothing it holds is found` on debt and nothing on any other record, a record whose place is gone prints `its file is no longer in the repository`, and an excluded place prints `its file is excluded by the settings, so nothing there was checked`, which wins over the place being gone, as when a folder the settings exclude holds a file that no longer exists; a `hone prune-debt` line carries the same reason after `stale`. A record that reaches a selected check its engine did not measure at a place that is in the repository and not excluded is not stale, and `hone prune-debt` leaves it; when an engine with selected checks measured no file at all, an `engine-not-run` line says so.

| Part | Text |
| --- | --- |
| `subject` | `<symptom> debt <file>` |
| `subject` | `<symptom> debt <file> carried` |
| `subject` | `<check> debt <file>` |
| `subject` | `<check> debt <file> carried` |
| `subject` | `<symptom> authorised-location <file>` |
| `subject` | `<symptom> authorised-location <file> carried` |
| `subject` | `<symptom> authorised-location <file> note: the catalogue has no case <case>, owing <owes>` |
| `subject` | `<symptom> authorised-location <file> note: <case name> does not owe <owes>` |
| `subject` | `<check> authorised-location <file>` |
| `subject` | `<check> authorised-location <file> carried` |
| `subject` | `<check> authorised-location <file> note: the catalogue has no case <case>, owing <owes>` |
| `subject` | `<check> authorised-location <file> note: <case name> does not owe <owes>` |
| `subject` | `<symptom>#<check name> authorised-location <file> note: the catalogue has no check <given> of <symptom>` |
| `subject` | `<symptom>#<check name> authorised-location <file> carried note: the catalogue has no check <given> of <symptom>` |
| `subject` | `<symptom>#<check name> authorised-location <file> note: the catalogue has no check <given> of <symptom> note: the catalogue has no case <case>, owing <owes>` |
| `subject` | `<symptom>#<check name> authorised-location <file> note: the catalogue has no check <given> of <symptom> note: <case name> does not owe <owes>` |
| `subject` | `<recipe> deviation <file>` |
| `subject` | `<outside party> boundary-record <module>` |
| `subject` | `<outside party> boundary-record <module> carried` |
| `subject` | `<dependency> dependency-record` |
| `reference` | `debt` |
| `reference` | `debt carried` |
| `reference` | `authorised-location` |
| `reference` | `authorised-location carried` |
| `reference` | `authorised-location note: the catalogue has no check <given> of <symptom>` |
| `reference` | `authorised-location carried note: the catalogue has no check <given> of <symptom>` |
| `reference` | `authorised-location note: the catalogue has no case <case>, owing <owes>` |
| `reference` | `authorised-location note: <case name> does not owe <owes>` |
| `reference` | `authorised-location note: the catalogue has no check <given> of <symptom> note: the catalogue has no case <case>, owing <owes>` |
| `reference` | `authorised-location note: the catalogue has no check <given> of <symptom> note: <case name> does not owe <owes>` |
| `reference` | `deviation <recipe>` |
| `reference` | `boundary-record <outside party>` |
| `reference` | `boundary-record <outside party> carried` |
| `reference` | `dependency-record <dependency>` |

A subject is its head, then ` carried` when the record is carried, then one ` note: ` for each catalogue note, the unknown check's first. A debt's or authorised location's head is `<symptom>`, `<check>` or `<symptom>#<check name>` by its reach, then its kind and `<file>`. A reference is the record's kind and, for a deviation, boundary record or dependency record, its recipe, outside party or dependency, followed by the same ` carried` and ` note: ` runs. Only a stated authorised location has a case or owes note, so a carried one prints at most the unknown check's note. The tables list every form this composition gives.

## Version 2 commands

The help below is what `hone --help` and `hone <command> --help` print for a repository that holds `hone.config.json`, for a folder that holds neither settings file, and when `--repo` is not given; a repository that holds `disciplines.json` prints the 1.x help shown above. `hone split-records --help` has no version 2 help, so it prints the 1.x help shown above under `hone split-records` for every repository.

The commands, their options and their exit codes are those of 1.x, with `split-records` removed; `upgrade` is the command listed above, with the help shown here. Help says "debt" where 1.x said "file carve-out", and "forfeiture" where 1.x said "decay". The synopsis, then the help of the tool and of each command, exactly as printed:
```text
hone check --repo <dir> [--base-revision <revision>] [--report-output <full|actionable|counts|verdict-only>] [--forfeiture <this-run|elsewhere>]
hone project --repo <dir>
hone record-debt --repo <dir> --base-revision <revision> [--leave <path>]...
hone prune-debt --repo <dir> [--base-revision <revision>] [--forfeiture <this-run|elsewhere>]
hone authorise --repo <dir> --answers <address> --file <path> --case <case> --owes <principle> --why <question>... --because <answer>... --evidence <evidence>... --root-cause <text> --root-evidence <text> --readback <text> --owner <owner>
hone upgrade --repo <dir>
hone --help
hone --version
```

```text
usage: hone <command> [options]

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
```

```text
usage: hone check --repo <dir> [--base-revision <revision>] [--report-output <full|actionable|counts|verdict-only>] [--forfeiture <this-run|elsewhere>]

check the repository against the checks hone.config.json lists and print the report, ending in its verdict

options:
  --repo <dir>
      the folder that holds hone.config.json, usually the repository root
  --base-revision <revision>
      the revision the change is measured from; without it no debt can be forfeited and no carried record is checked against it
  --report-output <full|actionable|counts|verdict-only>
      how much of the report to print, over reportOutput in hone.config.json; full when neither is set
  --forfeiture <this-run|elsewhere>
      check debt for forfeiture in this run or leave it to another, over forfeiture in hone.config.json; this-run when neither is set
  --help, -h
      print this help

exit codes:
  0  the verdict is pass
  1  the verdict is fail
  2  a load failure: an input could not be loaded, an engine failed, or Hone failed unexpectedly
```

```text
usage: hone project --repo <dir>

write the native configuration, hone.<engine>.mjs, and any file that types it beside it, for each engine that runs a listed check through one, printing each file as written or unchanged

options:
  --repo <dir>
      the folder that holds hone.config.json, usually the repository root
  --help, -h
      print this help

exit codes:
  0  every projection was written or already current
  2  any failure
```

```text
usage: hone record-debt --repo <dir> --base-revision <revision> [--leave <path>]...

add debt to hone-records for each symptom and file the check finds, printing each and what was done

options:
  --repo <dir>
      the folder that holds hone.config.json, usually the repository root
  --base-revision <revision>
      the branch's base, such as origin/main; a file it does not hold gets no debt
  --leave <path>
      a file or folder, relative to --repo, that gets no debt because a person records it as an authorised location; give it once for each path
  --help, -h
      print this help

exit codes:
  0  every debt needed was written, or none was needed
  2  a load failure: an input could not be loaded, an engine failed, the records could not be written, or Hone failed unexpectedly
```

```text
usage: hone prune-debt --repo <dir> [--base-revision <revision>] [--forfeiture <this-run|elsewhere>]

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
```

```text
usage: hone authorise --repo <dir> --answers <address> --file <path> --case <case> --owes <principle> --why <question>... --because <answer>... --evidence <evidence>... --root-cause <text> --root-evidence <text> --readback <text> --owner <owner>

write one authorised location to hone-records from the arguments given, with the why chain given, printing what was done

options:
  --repo <dir>
      the folder that holds hone.config.json, usually the repository root
  --answers <address>
      the symptom, or the symptom#check, the location answers, by the catalogue's names
  --file <path>
      the file the location is for, relative to --repo
  --case <case>
      the case the file is, as the cases page names it
  --owes <principle>
      the principle the case owes, as the cases page names it
  --why <question>
      one why of the chain, a question; give it, --because and --evidence once for each why, in order
  --because <answer>
      the answer to the why in the same place
  --evidence <evidence>
      what shows the answer, for the why in the same place
  --root-cause <text>
      the cause the fifth why names
  --root-evidence <text>
      the evidence that the cause still holds: what was run or read today, and what it showed
  --readback <text>
      the chain read back from the cause to the file
  --owner <owner>
      who decides whether this stays
  --help, -h
      print this help

exit codes:
  0  the location was written, was already held, or was refused with each reason printed
  2  a load failure: an input could not be loaded, an engine failed, the records could not be written, or Hone failed unexpectedly
```

```text
usage: hone upgrade --repo <dir>

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
```

On a repository that is already on version 2, `hone upgrade` prints `already on version 2; nothing to upgrade` and exits `0`. What it prints on a version 1 repository is listed under `hone upgrade` in the 1.x part of this page.

## Version 2 record commands

The commands that write and remove records in `hone-records` print one line for each record they write, leave or remove, and nothing when there is nothing to say. A line starts with an `<address>`, then a word that says what was done, then the `<file>` the record is about. The `<address>` is the symptom's name, or `<symptom>#<check>` when one check of it found the finding or the record names it. The `<records file>` is the file under `hone-records` that already holds the record, written as a path is.

`hone record-debt` takes the findings a run left unanswered and the native exceptions it left under `unrecorded`. It writes one debt record under `hone-records/debt/<symptom>.json` for each symptom, check and file, and prints a line for each finding and each such exception, so none is passed over without one. An inline disable or a TypeScript directive that no record holds is answered by debt on the check it escapes and its file, the same record a finding there would get; once the comment is removed and the code fixed, the debt is `stale` and `hone prune-debt` removes it. Debt holds something that is owed, so an exception that hides nothing on a file is never the source of a record. A `config-override` is such an exception: a file under it that breaks the check gets its debt from the finding, as any finding does, because Hone's own run does not read the override. An exception no record can hold, a `config-override`, an `ignore`, an `inline-rule-config`, a `suppression-entry` or a `command-line-option`, gets an `unrecordable` line that says what to do instead, so the check can still fail after `record-debt` only for a reason the command has printed. For a `suppression-entry` the line says to remove it: Hone's run finds the finding whether or not the entry hides it, so the same run has already recorded that finding as debt. For an `ignore` the line gives two routes: remove the ignore, since Hone's run checks the file and has already recorded what it finds there as debt, or, for a generated or vendored file, list it in `exclude` in `hone.config.json` so Hone's setting and the team's ignore agree. A file the settings exclude is never checked, so an `ignore` on it is not an unrecorded exception and prints no line; `record-debt` never writes an exclusion. A `command-line-option` gets the advice that matches why Hone could not judge it, the same advice the report gives on its `unrecorded` line. After the lines for debt it recorded, it prints one more line that names the command that puts the debt into effect. The `<address>` on that line is the check the exception names, or else its clause, and for a `command-line-option` the `<file>` is the `package.json` that holds the script. It writes nothing it could not stand behind: a file under `--leave`, a record already held, a finding the catalogue gives no symptom or check to record against, and a file this change created or changed when the run assesses forfeiture, get a line and no record. The last is decided by the same `forfeiture` setting and the same measured change as the check's answering, so a debt the command writes is a debt the check keeps; with `forfeiture` set to `elsewhere`, the check forfeits nothing, and the command writes debt on such a file like any other and prints no `touched` line. A finding on a file the run would forfeit is the change's own breach, so its line says to fix it there; the same file under an inline disable or a TypeScript directive says to fix what the comment hides, then remove the comment. The `<clause>` on an `unrecordable` line is the finding's clause address, since it has no symptom to name. It never writes an authorised location, a boundary record or anything that needs an owner's reason. Run twice, it writes nothing the second time.

| Output | Line |
| --- | --- |
| `record-debt` | `<address> recorded <file>` |
| `record-debt` | `<address> already-recorded <file>: <records file> already holds debt on this symptom and file; the check says why it does not answer` |
| `record-debt` | `<address> left <file>: under --leave <path>; record it as an authorised location with its own reason, or fix it` |
| `record-debt` | `<address> touched <file>: this change created or changed the file, so this run would forfeit debt on it; fix the finding there` |
| `record-debt` | `<address> touched <file>: this change created or changed the file, so this run would forfeit debt on it; fix what the comment hides, then remove the comment` |
| `record-debt` | `<clause> unrecordable <file>: the catalogue gives this finding no symptom or check to record debt against; fix the finding` |
| `record-debt` | `<address> unrecordable <file>: an ESLint ignore leaves the file out of the team's lint run, which no record can hold; Hone's run checked the file and recorded what it found there as debt, so what is left is the ignore: remove it, or, if the file is generated or vendored and not yours to hold to the checks, list it in exclude in hone.config.json so Hone's setting and the team's ignore agree` |
| `record-debt` | `<address> unrecordable <file>: a comment that sets a rule's configuration changes what the rule checks, which no record can hold; remove the comment` |
| `record-debt` | `<address> unrecordable <file>: an entry in the suppressions file hides a finding from the team's lint run, which no record can hold; Hone's run still finds it and records it as debt, so remove the entry from the suppressions file` |
| `record-debt` | `<address> unrecordable <file>: a lint-script option weakens the script's whole run, so no record can cover it; remove it from the script` |
| `record-debt` | `<address> unrecordable <file>: <command> is not the first command of its script, so Hone cannot tell what the option does to the files under check; give <command> a script of its own, such as <invocation>` |
| `record-debt` | `<address> unrecordable <file>: <wrapper> comes before <command> and is neither a package runner nor a NAME=value setting, so Hone cannot tell what the option does to the files under check; put only package runners and NAME=value settings before <command>` |
| `record-debt` | `<address> unrecordable <file>: a quote in the script has no partner, so Hone cannot read what the script passes to <command> or tell what that does to the files under check; pair every quote in the script` |
| `record-debt` | `<address> unrecordable <file>: an override in the ESLint configuration turns the check down for this file, which no record can hold; where debt holds the check the projection already turns it off, so remove the override or narrow it to the files that need it` |
| `record-debt` | `<address> unrecordable <file>: no record of this engine holds this comment; fix the code, or remove the comment` |
| `record-debt` | `run <project command> to put the recorded debt into effect` |

`hone prune-debt` takes the debt a run lists under `paid`, `stale` and `forfeited`, which are the records whose lines say to run it, and removes exactly those from `hone-records`, printing one line for each. A file left with no records is deleted. It leaves every other record, so each is still listed by the next run. The word after `removed` says which section listed the debt.

| Output | Line |
| --- | --- |
| `prune-debt` | `<address> removed <file>: paid` |
| `prune-debt` | `<address> removed <file>: stale` |
| `prune-debt` | `<address> removed <file>: stale, its file is no longer in the repository` |
| `prune-debt` | `<address> removed <file>: stale, its file is excluded by the settings` |
| `prune-debt` | `<address> removed <file>: forfeited` |

`hone authorise` writes one authorised location under `hone-records/authorised-locations/<symptom>.json` from the arguments it is given, with the why chain the person supplied. It never writes a why of its own. It refuses a chain the why-chain form refuses, and a symptom the catalogue does not name, and writes nothing then. It never refuses a case or an `owes` the catalogue does not list: the record is written and the next run prints a note for it. A `refused` line is printed for each reason, and a `form-refused` line names the `<path>` in the record and the `<message>` the form gives; the `<given>` is what was typed, quoted.

| Output | Line |
| --- | --- |
| `authorise` | `<address> authorised <file>` |
| `authorise` | `<address> already-authorised <file>: <records file> already holds this record` |
| `authorise` | `<address> refused <file>: unknown-symptom "<given>"` |
| `authorise` | `<address> refused <file>: not-a-records-name "<given>"` |
| `authorise` | `<address> refused <file>: form-refused <path>: <message>` |

## Version 2 load failures

A version 2 run that cannot decide prints one line and exits `2`, as in 1.x. The line starts with `load failure: ` and its kind, and the values follow in the order shown. A `<check>` is the address as `hone.config.json` lists it and may hold a space, so a tool reads a load failure by its kind, and by the values only up to the first one that may hold a space. The text after a `:` that ends the values is not stable. A minor release may add a kind; a tool passes over a kind it does not know.

Version 2 renames the 1.x kinds whose names spoke of clauses, disciplines, mechanisms, runners and pieces:
- `selection-absent` is `config-absent`, and a `--repo` folder that holds neither `disciplines.json` nor `hone.config.json` prints `config-absent` from every command: only a folder holding `disciplines.json` runs on version 1;
- `unknown-discipline` and `unknown-clause` are `unknown-check`;
- `duplicate-clause` is `duplicate-check`;
- `judgement-clause-selected` and `judgement-clause-listed` are `review-only-listed`;
- `mechanism-not-allowed` is `engine-not-allowed`;
- `runner-missing`, `runner-invalid` and `runner-failed` are `engine-missing`, `engine-invalid` and `engine-failed`;
- `piece-missing` is `check-missing`.

It never prints `why-chains-required`, `records-in-both-layouts` or `records-unsplittable`. An `<engine>` is the engine's name, or the mechanism's id when the catalogue names no engine for it.

`records-refused` prints every records document refused, in the records' order, each as its records file, its refusal kind and its issues, joined by `; `. The line grows with the number of refused documents, so that one run shows everything to fix. A refused record, as opposed to a refused document, is not a load failure: it is listed under `refused`, and an authorised location is never refused for what it claims.

`catalogue-not-read` is printed when the tool's own symptom catalogue is absent or cannot be read, since every record resolves against it. A team rule set with no catalogue is not a load failure. `upgrade-needed` is printed when a version 2 run finds version 1 files. It names the `hone upgrade` command that rewrites them, with the repository's own invocation when the install can be located, and plain `hone upgrade` otherwise.

`settings-in-both-versions` is printed when the folder holds both `disciplines.json` and `hone.config.json`, since no run can tell which one the repository means. `not-ready-yet` is printed when a version 2 repository asks for something this release does not yet run on version 2 files: a command, named by the command, or other version 2 repositories inside this one, named `eslint-config-roots`, for which it names the first three folders and a count of the rest. A release that runs them stops printing it.

| Kind | Line |
| --- | --- |
| `arguments-invalid` | `load failure: arguments-invalid <detail>` |
| `install-root-unresolvable` | `load failure: install-root-unresolvable <url> <detail>` |
| `file-unreadable` | `load failure: file-unreadable <path> <detail>` |
| `file-malformed` | `load failure: file-malformed <path> <detail>` |
| `file-unwritable` | `load failure: file-unwritable <path> <detail>` |
| `unsupported-version` | `load failure: unsupported-version <path> <version found>` |
| `reserved-rule-set-name` | `load failure: reserved-rule-set-name <rule set>` |
| `rule-set-name-collision` | `load failure: rule-set-name-collision <rule set> <other rule set>` |
| `unknown-rule-set` | `load failure: unknown-rule-set <rule set>` |
| `rule-set-invalid` | `load failure: rule-set-invalid <path> <detail>` |
| `git-failed` | `load failure: git-failed <detail>` |
| `config-root-untracked` | `load failure: config-root-untracked <config root>: an eslintConfigRoots entry is a folder git tracks files under outside every excluded path, spelled exactly as git spells it; fix or remove it in hone.config.json` |
| `unexpected-error` | `load failure: unexpected-error <detail>` |
| `config-absent` | `load failure: config-absent <dir> holds no hone.config.json; give the folder that holds it, usually the repository root` |
| `settings-in-both-versions` | `load failure: settings-in-both-versions <dir>: it holds both disciplines.json and hone.config.json; keep the one this repository runs on and remove the other` |
| `not-ready-yet` | `load failure: not-ready-yet <command>: this release runs <command> on version 1 files only, and this repository holds hone.config.json` |
| `not-ready-yet` | `load failure: not-ready-yet eslint-config-roots: this release does not run a repository that holds other version 2 repositories yet; folders holding hone.config.json: <folders>; move them out of this repository, and run each on its own with --repo` |
| `unknown-check` | `load failure: unknown-check <check>` |
| `review-only-listed` | `load failure: review-only-listed <check>: a check enforced by review has no engine and is left out of checks; remove it` |
| `duplicate-check` | `load failure: duplicate-check <settings key> <check> <check with its rule set>` |
| `engine-not-allowed` | `load failure: engine-not-allowed <check> <engine>: it runs on <engines>; list it with one of those` |
| `engine-not-allowed` | `load failure: engine-not-allowed <check> <engine>: the rule set does not run that check on that engine, though its catalogue says it does; list the check with an engine its rule set runs it on, or correct the rule set` |
| `engine-missing` | `load failure: engine-missing <engine>` |
| `engine-invalid` | `load failure: engine-invalid <engine> <detail>` |
| `engine-failed` | `load failure: engine-failed <engine> piece-invalid <piece folder> <detail>` |
| `engine-failed` | `load failure: engine-failed <engine> file-unreadable <file> <detail>` |
| `engine-failed` | `load failure: engine-failed <engine> file-unparseable <file> <detail>` |
| `engine-failed` | `load failure: engine-failed <engine> tool-failed <detail>` |
| `engine-failed` | `load failure: engine-failed <engine> plugin-conflict <detail>` |
| `engine-failed` | `load failure: engine-failed <engine> team-config-unloadable <detail>` |
| `engine-failed` | `load failure: engine-failed <engine> runner-invalid-output <detail>` |
| `engine-failed` | `load failure: engine-failed <engine> toolchain-unavailable <package> found <version found>, supported <range>: add a supported version to the devDependencies of the repository root` |
| `engine-failed` | `load failure: engine-failed <engine> toolchain-unavailable <package> found not installed, supported <range>: <package> is a required peer of @hailstails/hone, so this install is incomplete; add a supported version to the devDependencies of the repository root and reinstall` |
| `engine-failed` | `load failure: engine-failed <engine> toolchain-unavailable <package> found <version found>, supported <range>; <other package> found <version found>, supported <range>: add a supported version of each to the devDependencies of the repository root` |
| `engine-failed` | `load failure: engine-failed <engine> toolchain-shadowed <package> resolved from <location> inside the core install <install folder>: delete <install folder>/node_modules, then reinstall the package with the repository's package manager, so the repository's own copy is used` |
| `check-missing` | `load failure: check-missing <check> <engine>` |
| `checks-run-together` | `load failure: checks-run-together <check> <other checks>: these checks are one rule today, so they run together; list each of them as <check> is listed` |
| `check-settings-refused` | `load failure: check-settings-refused <check> unlisted: checkSettings gives settings only to a check listed to run; list it under checks or remove its settings` |
| `check-settings-refused` | `load failure: check-settings-refused <check> <state>: checkSettings gives settings only to a check listed to run; run it or remove its settings` |
| `check-settings-differ` | `load failure: check-settings-differ <check> <other check>: these checks are one rule today, so they take one set of settings; give them the same settings` |
| `records-folder-unreadable` | `load failure: records-folder-unreadable <records folder> <detail>` |
| `records-file-unreadable` | `load failure: records-file-unreadable <records file> <detail>` |
| `records-file-not-json` | `load failure: records-file-not-json <records file> <detail>` |
| `not-a-records-file` | `load failure: not-a-records-file <records file>: a records file is boundary-records.json or dependency-records.json, or a .json file named for its symptom, or for its recipe in deviations, inside the folder authorised-locations, debt or deviations of hone-records; move this file to where its kind belongs, or out of hone-records if it holds no records` |
| `not-a-records-name` | `load failure: not-a-records-name <records folder> <name>: no repository path can hold that name; rename it` |
| `records-refused` | `load failure: records-refused <records file> document-refused <document issues>` |
| `records-refused` | `load failure: records-refused <records file> not-a-records-file` |
| `records-refused` | `load failure: records-refused <records file> document-refused <document issues>; <other records file> not-a-records-file` |
| `catalogue-not-read` | `load failure: catalogue-not-read <path>: the symptom catalogue is missing from this install; reinstall @hailstails/hone` |
| `catalogue-not-read` | `load failure: catalogue-not-read <path> <detail>` |
| `upgrade-needed` | `load failure: upgrade-needed <path>: this is a version 1 file; run <upgrade command>, which rewrites every version 1 file as version 2, and commit what it writes` |
| `upgrade-needed` | `load failure: upgrade-needed <path>: this is a version 1 file; run hone upgrade, which rewrites every version 1 file as version 2, and commit what it writes` |