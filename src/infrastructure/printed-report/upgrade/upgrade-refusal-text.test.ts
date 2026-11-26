import { describe, expect, it } from "vitest";

import type { UpgradeFailure } from "../../../application/ports/upgrade/upgrade-stop.ts";
import { catalogueNameOf } from "../../../domain/language-layer/catalogue-name.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../../domain/rule-set/rule-set-name-of.ts";
import { createPathPort } from "../../node/path-port.ts";
import { type UpgradeFailureOutcome, upgradeFailureOutcomeOf } from "./upgrade-refusal-text.ts";

const ISSUES = "https://github.com/HailsTails/hone/issues";

const FAULT = `This is a fault in hone, not in your repository. Report it at ${ISSUES}, with this output.`;

const SETTINGS = absoluteRootOf("/repo/hone.config.json");

const OLD_FILE = absoluteRootOf("/repo/disciplines.eslint.mjs");

const RECORDS_FOLDER = absoluteRootOf("/repo/hone-records");

const OLD_SETTINGS = absoluteRootOf("/repo/disciplines.json");

type Row = {
  readonly name: string;
  readonly failure: UpgradeFailure;
  readonly outcome: UpgradeFailureOutcome;
};

const PLACEMENT = {
  repoRoot: absoluteRootOf("/repo"),
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
};

describe("upgradeFailureOutcomeOf", () => {
  it.each<Row>([
    {
      name: "the version 1 run cannot be made for the oracle",
      failure: {
        kind: "oracle-failed",
        failure: {
          kind: "version-one-run-failed",
          detail: "eslint not run: its projection is missing",
        },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nversion 1's own run could not be made (eslint not run: its projection is missing). Fix what it names, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "a carve-out is held twice",
      failure: {
        kind: "oracle-failed",
        failure: {
          kind: "record-doubly-held",
          clause: "CD-14#class-syntax",
          file: repoPathOf("src/a.ts"),
        },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nCD-14#class-syntax in src/a.ts is held by both a file carve-out and an authorised location. Remove one of them first, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "version 2's projection cannot be made",
      failure: {
        kind: "plan-refused",
        refusal: {
          kind: "projection-failed",
          failure: { kind: "unknown-check", check: "names#names" },
        },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nversion 2's projection could not be made (load failure: unknown-check names#names). Fix what it names, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "a version 1 projection has no version 2 projection to take its place",
      failure: {
        kind: "plan-refused",
        refusal: {
          kind: "projections-unpaired",
          refusal: {
            kind: "version-one-projection-unpaired",
            projection: repoPathOf("packages/a/disciplines.eslint.mjs"),
            config: repoPathOf("packages/a/eslint.config.mjs"),
            folder: "packages/a",
          },
        },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nthe version 1 projection packages/a/disciplines.eslint.mjs has no version 2 projection to take its place, since version 2 runs no lint config in packages/a. Remove it and its import in packages/a/eslint.config.mjs, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "version 2 would project a file no version 1 projection stands behind",
      failure: {
        kind: "plan-refused",
        refusal: {
          kind: "projections-unpaired",
          refusal: {
            kind: "version-two-projection-unpaired",
            file: repoPathOf("packages/a/hone.eslint.mjs"),
            folder: "packages/a",
          },
        },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nversion 2 would project packages/a/hone.eslint.mjs, but version 1 projects nothing in packages/a: it leaves out a folder that holds its own disciplines.json. Remove that disciplines.json and spread ./disciplines.eslint.mjs last in the ESLint config of packages/a, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "version 2 would project a file at the repository root that version 1 has no projection for",
      failure: {
        kind: "plan-refused",
        refusal: {
          kind: "projections-unpaired",
          refusal: {
            kind: "version-two-projection-unpaired",
            file: repoPathOf("hone.eslint.mjs"),
            folder: "",
          },
        },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nversion 2 would project hone.eslint.mjs, but version 1 projects nothing in the repository root: it leaves out a folder that holds its own disciplines.json. Remove that disciplines.json and spread ./disciplines.eslint.mjs last in the ESLint config of the repository root, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "a version 1 slice belongs to no config root and is out of date",
      failure: {
        kind: "plan-refused",
        refusal: {
          kind: "slice-left-in-place",
          files: [
            repoPathOf("old/disciplines.eslint.mjs"),
            repoPathOf("older/disciplines.eslint.mjs"),
          ],
        },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nthe version 1 projection old/disciplines.eslint.mjs belongs to no config root and is out of date. Delete it or restore its config root, commit, then run the upgrade again.\nthe version 1 projection older/disciplines.eslint.mjs belongs to no config root and is out of date. Delete it or restore its config root, commit, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "a refusal comes after version 1's project removed a slice",
      failure: {
        kind: "plan-refused",
        refusal: {
          kind: "team-config-refused",
          refusal: {
            kind: "no-file-imports-projection",
            projection: repoPathOf("disciplines.eslint.mjs"),
          },
        },
        removedByVersionOne: [repoPathOf("old/disciplines.eslint.mjs")],
      },
      outcome: {
        code: 1,
        text: 'upgrade refused:\nno file imports disciplines.eslint.mjs with a static default import. Change the ESLint config next to it to import it in the form import projection from "./disciplines.eslint.mjs", then run the upgrade again.\nversion 1\'s own project removed these files, and the upgrade does not put them back; restore them from version control:\n  /repo/old/disciplines.eslint.mjs\n',
      },
    },
    {
      name: "the root projection is in no config",
      failure: {
        kind: "oracle-failed",
        failure: {
          kind: "projection-not-current",
          file: repoPathOf("disciplines.eslint.mjs"),
          state: "not-included",
        },
        removedByVersionOne: [repoPathOf("old/disciplines.eslint.mjs")],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nthe version 1 projection disciplines.eslint.mjs is not-included. Spread its default export last in the ESLint config that loads for the repository root, then run the upgrade again.\nversion 1's own project removed these files, and the upgrade does not put them back; restore them from version control:\n  /repo/old/disciplines.eslint.mjs\n",
      },
    },
    {
      name: "a version 1 slice has no config in its folder",
      failure: {
        kind: "oracle-failed",
        failure: {
          kind: "projection-not-current",
          file: repoPathOf("packages/a/disciplines.eslint.mjs"),
          state: "unconfigured",
        },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nthe version 1 projection packages/a/disciplines.eslint.mjs is unconfigured. Spread its default export last in the ESLint config that loads for packages/a, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "a version 1 slice is not applied by its config",
      failure: {
        kind: "oracle-failed",
        failure: {
          kind: "projection-not-current",
          file: repoPathOf("packages/a/disciplines.eslint.mjs"),
          state: "not-applied",
        },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nthe version 1 projection packages/a/disciplines.eslint.mjs is not-applied. Spread its default export last in the ESLint config that loads for packages/a, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "an authorised location was given no answer",
      failure: {
        kind: "plan-refused",
        refusal: {
          kind: "location-unanswered",
          clause: "CD-27#test-body-logic",
          file: repoPathOf("src/a.ts"),
        },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: `upgrade refused:
the authorised location for CD-27#test-body-logic in src/a.ts was given no answer. ${FAULT}
Nothing was changed.
`,
      },
    },
    {
      name: "the team config's import is not static",
      failure: {
        kind: "plan-refused",
        refusal: {
          kind: "config-import-refused",
          refusal: {
            kind: "no-projection-import",
            file: repoPathOf("packages/a/eslint.config.mjs"),
            projection: repoPathOf("packages/a/disciplines.eslint.mjs"),
          },
        },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: 'upgrade refused:\npackages/a/eslint.config.mjs holds no static default import of packages/a/disciplines.eslint.mjs. Change its import of it to the form import projection from "./disciplines.eslint.mjs", then run the upgrade again.\nNothing was changed.\n',
      },
    },
    {
      name: "a config names the version 1 projection outside its import",
      failure: {
        kind: "plan-refused",
        refusal: {
          kind: "config-import-refused",
          refusal: { kind: "projection-named-elsewhere", file: repoPathOf("eslint.config.mjs") },
        },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\neslint.config.mjs names a version 1 projection outside the imports the upgrade rewrites, or imports one version 1 did not write. Remove the other mention or import, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "the written records would reach beyond the entries",
      failure: {
        kind: "plan-refused",
        refusal: {
          kind: "reach-beyond-entries",
          records: [{ symptom: "loop-keyword#loops", file: "src/b.ts" }],
        },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: `upgrade refused:\nthe version 2 records would reach beyond the version 1 entries: loop-keyword#loops in src/b.ts.\n${FAULT}\nNothing was changed.\n`,
      },
    },
    {
      name: "no file imports the version 1 projection",
      failure: {
        kind: "plan-refused",
        refusal: {
          kind: "team-config-refused",
          refusal: {
            kind: "no-file-imports-projection",
            projection: repoPathOf("packages/a/disciplines.eslint.mjs"),
          },
        },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: 'upgrade refused:\nno file imports packages/a/disciplines.eslint.mjs with a static default import. Change the ESLint config next to it to import it in the form import projection from "./disciplines.eslint.mjs", then run the upgrade again.\nNothing was changed.\n',
      },
    },
    {
      name: "version 1's own project fails",
      failure: { kind: "version-one-project-failed", detail: "disk full", removedByVersionOne: [] },
      outcome: {
        code: 1,
        text: "upgrade refused:\nversion 1's own project failed (disk full). Fix what it names, then run the upgrade again.\nversion 1's own project may have changed files before it failed; check version control for what it changed.\n",
      },
    },
    {
      name: "version 1 already reports clauses uncovered",
      failure: {
        kind: "version-one-uncovered",
        clauses: [
          {
            ruleSet: TOOL_RULE_SET,
            discipline: disciplineIdOf("CD-1"),
            clause: clauseIdOf("claimed-type"),
          },
          {
            ruleSet: TOOL_RULE_SET,
            discipline: disciplineIdOf("CD-2"),
            clause: clauseIdOf("claimed-members"),
          },
        ],
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nversion 1 already reports CD-1#claimed-type, CD-2#claimed-members as uncovered. Select or mark each of them in disciplines.json, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "version 1's run fails",
      failure: {
        kind: "version-one-run-failed",
        failure: { kind: "run-failed", detail: "disciplines.json is malformed" },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nversion 1's run failed (disciplines.json is malformed). Fix what it names, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "a smoothing step's run fails and a removed file cannot be put back",
      failure: {
        kind: "smoothing-failed",
        step: "prune-debt",
        failure: {
          kind: "run-failed",
          failure: {
            kind: "projection-stale",
            problem: { scope: "projection", engine: { name: "eslint" }, state: "out-of-date" },
            projectCommand: "hone project --repo /repo",
            projectionKind: "mjs",
          },
        },
        unrestored: [{ written: "file-removed", path: SETTINGS, detail: "EPERM" }],
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nthe upgrade's prune-debt step failed (load failure: projection-stale eslint out-of-date: hone.eslint.mjs differs from what hone project writes now; run hone project --repo /repo and commit every file it writes). Fix what it names, then run the upgrade again.\nThese files could not be put back; put them right by hand:\n  restore /repo/hone.config.json from version control (EPERM)\n",
      },
    },
    {
      name: "the measured run before removing carried records leaves something unmeasured",
      failure: {
        kind: "smoothing-failed",
        step: "remove-carried",
        failure: {
          kind: "run-unmeasured",
          unmeasured: [
            { kind: "engine-not-run", engine: { name: "eslint" }, projection: "measured-nothing" },
          ],
        },
        unrestored: [],
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nthe upgrade's remove-carried step could not judge which carried records answer nothing, because version 2 left this unmeasured:\n  engine-not-run eslint measured-nothing: the eslint engine measured no file in this run, so the records its checks answer were not judged, neither kept as answering nor removed as stale; check that the eslint configuration lints the files under check\nFix what it names, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "version 2's check fails on the upgraded repository",
      failure: {
        kind: "check-failed",
        failing: [
          "unrecorded (1)",
          "claimed-type#cast-expressions eslint ignore hone.eslint.d.mts",
        ],
        unrestored: [],
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nversion 2's check fails on the upgraded repository:\n  unrecorded (1)\n  claimed-type#cast-expressions eslint ignore hone.eslint.d.mts\nFix what it reports, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "a records file a smoothing step removes cannot be read",
      failure: {
        kind: "write-refused",
        refusal: {
          failure: { kind: "removed-file-unreadable", path: SETTINGS, detail: "EACCES" },
          unrestored: [],
        },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\n/repo/hone.config.json could not be read to be removed (EACCES). Make it readable, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "a slice version 1 removed cannot be placed in the repository",
      failure: {
        kind: "unplaceable-path",
        file: repoPathOf("old/disciplines.eslint.mjs"),
        removedByVersionOne: [repoPathOf("old/disciplines.eslint.mjs")],
      },
      outcome: {
        code: 1,
        text: `upgrade refused:\nold/disciplines.eslint.mjs cannot be placed in the repository. ${FAULT}\nversion 1's own project removed these files, and the upgrade does not put them back; restore them from version control:\n  /repo/old/disciplines.eslint.mjs\n`,
      },
    },
    {
      name: "a file the upgrade wrote cannot be put back after version 1's project removed a slice",
      failure: {
        kind: "version-two-run-failed",
        failure: { kind: "run-failed", detail: "config unreadable" },
        unrestored: [{ written: "file-created", path: SETTINGS, detail: "EBUSY" }],
        removedByVersionOne: [repoPathOf("old/disciplines.eslint.mjs")],
      },
      outcome: {
        code: 1,
        text: `upgrade refused:\nversion 2's run failed (config unreadable). ${FAULT}\nversion 1's own project removed these files, and the upgrade does not put them back; restore them from version control:\n  /repo/old/disciplines.eslint.mjs\nThese files could not be put back; put them right by hand:\n  delete /repo/hone.config.json (EBUSY)\n`,
      },
    },
    {
      name: "a version 2 file already exists",
      failure: {
        kind: "write-refused",
        refusal: { failure: { kind: "path-already-exists", path: SETTINGS }, unrestored: [] },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\n/repo/hone.config.json already exists. Move it aside, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "a file cannot be removed",
      failure: {
        kind: "write-refused",
        refusal: {
          failure: { kind: "unremovable", path: OLD_FILE, detail: "EBUSY" },
          unrestored: [],
        },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\n/repo/disciplines.eslint.mjs could not be removed (EBUSY). Fix what the detail names, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "the version 2 run fails and a file cannot be put back",
      failure: {
        kind: "version-two-run-failed",
        failure: { kind: "run-failed", detail: "config unreadable" },
        unrestored: [
          { written: "file-created", path: SETTINGS, detail: "EBUSY" },
          { written: "directory-created", path: RECORDS_FOLDER, detail: "EACCES" },
          { written: "file-replaced", path: OLD_FILE, detail: "EPERM" },
          { written: "file-removed", path: OLD_FILE, detail: "EEXIST" },
        ],
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: `upgrade refused:\nversion 2's run failed (config unreadable). ${FAULT}\nThese files could not be put back; put them right by hand:\n  delete /repo/hone.config.json (EBUSY)\n  delete the empty folder /repo/hone-records (EACCES)\n  restore /repo/disciplines.eslint.mjs from version control (EPERM)\n  restore /repo/disciplines.eslint.mjs from version control (EEXIST)\n`,
      },
    },
    {
      name: "inline directives of both kinds, after version 1's own project removed a file",
      failure: {
        kind: "directives-name-no-check",
        directives: [
          {
            kind: "names-no-check",
            ruleId: "hone/no-such-check",
            file: repoPathOf("src/a.ts"),
            line: 3,
            text: "the text",
          },
          {
            kind: "version-1-id",
            ruleId: "hone/no-class-authoring",
            file: repoPathOf("src/b.ts"),
            line: 7,
            text: "the text",
            replacedBy: ["hone/authored-class-or-this#class-keyword"],
          },
        ],
        unrestored: [],
        removedByVersionOne: [repoPathOf("old/disciplines.eslint.mjs")],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nthese inline directives name a version 1 rule id, which version 2 names differently:\n  src/b.ts:7 hone/no-class-authoring: write hone/authored-class-or-this#class-keyword\nReplace each version 1 id with the version 2 id shown, then run the upgrade again.\nthese inline directives name a hone rule id that version 2 has no check under:\n  src/a.ts:3 hone/no-such-check\nFix each one to name a check of version 2, or remove it, then run the upgrade again.\nversion 1's own project removed these files, and the upgrade does not put them back; restore them from version control:\n  /repo/old/disciplines.eslint.mjs\n",
      },
    },
    {
      name: "an inline directive naming a hone rule id that version 2 has no check under, with nothing changed",
      failure: {
        kind: "directives-name-no-check",
        directives: [
          {
            kind: "names-no-check",
            ruleId: "hone/no-such-check",
            file: repoPathOf("src/a.ts"),
            line: 3,
            text: "the text",
          },
        ],
        unrestored: [],
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nthese inline directives name a hone rule id that version 2 has no check under:\n  src/a.ts:3 hone/no-such-check\nFix each one to name a check of version 2, or remove it, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "an inline directive naming a version 1 rule id that version 2 runs as several checks, with nothing changed",
      failure: {
        kind: "directives-name-no-check",
        directives: [
          {
            kind: "version-1-id",
            ruleId: "hone/no-class-authoring",
            file: repoPathOf("src/a.ts"),
            line: 3,
            text: "the text",
            replacedBy: ["hone/a#first", "hone/a#second"],
          },
        ],
        unrestored: [],
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nthese inline directives name a version 1 rule id, which version 2 names differently:\n  src/a.ts:3 hone/no-class-authoring: write each of hone/a#first, hone/a#second\nReplace each version 1 id with the version 2 id shown, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "a version 1 file cannot be removed",
      failure: {
        kind: "removal-failed",
        failure: {
          kind: "unremovable",
          path: OLD_FILE,
          detail: "EBUSY",
          removed: { files: [], folders: [] },
        },
        written: [repoPathOf("hone.config.json"), repoPathOf("hone.eslint.mjs")],
        replaced: [repoPathOf("eslint.config.mjs"), repoPathOf("packages/a/eslint.config.mjs")],
        remaining: [OLD_FILE, OLD_SETTINGS],
      },
      outcome: {
        code: 3,
        text: "upgrade incomplete:\nversion 2 is in place (written: hone.config.json, hone.eslint.mjs; replaced: eslint.config.mjs, packages/a/eslint.config.mjs), but /repo/disciplines.eslint.mjs could not be removed (EBUSY).\nDelete these version 1 files by hand, then commit:\n  /repo/disciplines.eslint.mjs\n  /repo/disciplines.json\n",
      },
    },
    {
      name: "team clauses and definitions have not been written",
      failure: {
        kind: "plan-refused",
        refusal: {
          kind: "team-names-missing",
          missing: [
            {
              missing: "clause",
              clause: {
                ruleSet: { name: ruleSetNameOf("acme") },
                discipline: disciplineIdOf("ACME-1"),
                clause: clauseIdOf("console-calls"),
              },
              namesFile: repoPathOf("acme/version-two-names.json"),
            },
            {
              missing: "own-check-name",
              clause: {
                ruleSet: { name: ruleSetNameOf("acme") },
                discipline: disciplineIdOf("ACME-1"),
                clause: clauseIdOf("loop-calls"),
              },
              check: { symptom: catalogueNameOf("loop-keyword"), check: catalogueNameOf("loops") },
              namesFile: repoPathOf("acme/version-two-names.json"),
            },
            {
              missing: "definition",
              definition: { kind: "symptom", name: "direct-console" },
              namesFile: repoPathOf("acme/version-two-names.json"),
            },
            {
              missing: "definition",
              definition: { kind: "case", name: "changes-a-repository" },
              namesFile: repoPathOf("acme/version-two-names.json"),
            },
            {
              missing: "definition",
              definition: { kind: "principle", name: "repository-ready" },
              namesFile: repoPathOf("acme/version-two-names.json"),
            },
            {
              missing: "definition",
              definition: { kind: "rule", name: "no-console" },
              namesFile: repoPathOf("acme/version-two-names.json"),
            },
          ],
        },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: 'upgrade refused:\nthe version 2 layout needs names and definitions your team has not written, and these are judgements your team makes, so the upgrade does not write them:\n  acme/ACME-1#console-calls has no version 2 name: add ACME-1#console-calls with its check and title under "clauses" in acme/version-two-names.json\n  acme/ACME-1#loop-calls is named loop-keyword#loops, which is already one of Hone\'s checks: give it a check name of its own under "clauses" in acme/version-two-names.json\n  the symptom direct-console has no definition: add it under "symptoms" in acme/version-two-names.json\n  the case changes-a-repository has no definition: add it under "cases" in acme/version-two-names.json\n  the principle repository-ready has no definition: add it under "principles" in acme/version-two-names.json\n  the rule no-console has no definition: add it under "rules" in acme/version-two-names.json\nWrite each in the names file, with the facts docs/extending.md gives each kind, then run the upgrade again.\nNothing was changed.\n',
      },
    },
    {
      name: "one version 1 module serves clauses that become separate checks",
      failure: {
        kind: "plan-refused",
        refusal: {
          kind: "piece-folder-unsplittable",
          folder: repoPathOf("acme/mechanisms/audit/ACME-2"),
          split: {
            fault: "module-shared",
            module: repoPathOf("scratch.ts"),
            clauses: [
              {
                ruleSet: { name: ruleSetNameOf("acme") },
                discipline: disciplineIdOf("ACME-2"),
                clause: clauseIdOf("draft-files"),
              },
              {
                ruleSet: { name: ruleSetNameOf("acme") },
                discipline: disciplineIdOf("ACME-2"),
                clause: clauseIdOf("scratch-files"),
              },
            ],
          },
        },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\none module, acme/mechanisms/audit/ACME-2/scratch.ts, serves acme/ACME-2#draft-files, acme/ACME-2#scratch-files, which version 2 makes separate checks, and a module moves to one check only. Give each clause a module of its own, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "a moved file names a module with an expression",
      failure: {
        kind: "plan-refused",
        refusal: {
          kind: "piece-folder-unsplittable",
          folder: repoPathOf("acme/mechanisms/audit/ACME-2"),
          split: {
            fault: "specifier-not-literal",
            file: repoPathOf("acme/mechanisms/audit/ACME-2/drafts.ts"),
            line: 4,
          },
        },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nacme/mechanisms/audit/ACME-2/drafts.ts:4 names a module with an expression rather than a string, so the upgrade cannot point it at where the files of acme/mechanisms/audit/ACME-2 move. Write the path as a string, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "a moved file imports something in its folder that the upgrade does not move",
      failure: {
        kind: "plan-refused",
        refusal: {
          kind: "piece-folder-unsplittable",
          folder: repoPathOf("acme/mechanisms/audit/ACME-2"),
          split: {
            fault: "target-not-moved",
            file: repoPathOf("acme/mechanisms/audit/ACME-2/drafts.ts"),
            line: 2,
          },
        },
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nacme/mechanisms/audit/ACME-2/drafts.ts:2 imports something in acme/mechanisms/audit/ACME-2 that the upgrade does not move: piece.json, which the upgrade replaces, the folder itself, or a file that is not there. So it cannot point the import at where the folder's files move. Fix or remove the import, then run the upgrade again.\nNothing was changed.\n",
      },
    },
    {
      name: "the rule set written from the names file cannot be read",
      failure: {
        kind: "team-layout-unreadable",
        failure: {
          kind: "rule-set-invalid",
          path: "/repo/acme/rules/typescript/symptoms/direct-console.md",
          detail: "symptoms names gone, which the catalogue does not hold",
        },
        unrestored: [
          {
            written: "file-created",
            path: absoluteRootOf("/repo/acme/rules/typescript/symptoms/direct-console.md"),
            detail: "EBUSY",
          },
        ],
        removedByVersionOne: [],
      },
      outcome: {
        code: 1,
        text: "upgrade refused:\nthe rule set the upgrade wrote from your names file cannot be read (rule-set-invalid /repo/acme/rules/typescript/symptoms/direct-console.md symptoms names gone, which the catalogue does not hold). Correct what it names in the names file, then run the upgrade again.\nThese files could not be put back; put them right by hand:\n  delete /repo/acme/rules/typescript/symptoms/direct-console.md (EBUSY)\n",
      },
    },
  ])("says what to do when $name", ({ failure, outcome }) => {
    expect(upgradeFailureOutcomeOf({ failure, placement: PLACEMENT })).toEqual(outcome);
  });
});
