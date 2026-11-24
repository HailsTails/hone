import { describe, expect, it } from "vitest";

import type { Check } from "../../../domain/language-layer/symptom-catalogue.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { createPathPort } from "../../node/path-port.ts";
import {
  mapCurrentNamesUpgradeToOutcome,
  upgradeSuccessOutcomeOf,
} from "./upgrade-success-text.ts";

const REPO = absoluteRootOf("/repo");

const LOOPS_CLAUSE: ClauseAddress = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("loops"),
};

const LOOP_KEYWORD_LOOPS: Check = {
  name: "loops",
  symptom: { ruleSet: "hone", name: "loop-keyword" },
  page: "loop-keyword/loops.md",
  clause: LOOPS_CLAUSE,
  engines: [{ name: "walker" }],
  forms: [],
  findingSpecifics: [],
};

const REBINDING_LOOPS: Check = {
  ...LOOP_KEYWORD_LOOPS,
  symptom: { ...LOOP_KEYWORD_LOOPS.symptom, name: "rebinding" },
};

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

describe("upgradeSuccessOutcomeOf", () => {
  it("lists what was written, what was rewritten and what was removed, relative to the repository", () => {
    expect(
      upgradeSuccessOutcomeOf({
        repoRoot: REPO,
        path: PATH,
        carried: {
          written: [
            repoPathOf("hone.config.json"),
            repoPathOf("hone-records/debt/loop-keyword.json"),
          ],
          replaced: [repoPathOf("eslint.config.mjs"), repoPathOf("packages/a/eslint.config.mjs")],
          removed: {
            files: [
              absoluteRootOf("/repo/discipline-exceptions/cd-15.json"),
              absoluteRootOf("/repo/disciplines.json"),
            ],
            folders: [absoluteRootOf("/repo/discipline-exceptions")],
          },
          records: [
            {
              recordKind: "file-carve-out",
              clause: LOOPS_CLAUSE,
              file: repoPathOf("src/a.ts"),
              newKind: "debt",
              check: LOOP_KEYWORD_LOOPS,
              holding: "stated",
            },
            {
              recordKind: "authorised-location",
              clause: LOOPS_CLAUSE,
              file: repoPathOf("src/b.ts"),
              newKind: "authorised-location",
              check: LOOP_KEYWORD_LOOPS,
              holding: "carried",
            },
          ],
          findings: 3,
          mentions: [
            { file: repoPathOf(".github/workflows/ci.yml"), line: 12 },
            { file: repoPathOf("package.json"), line: 4 },
          ],
          unread: [
            { file: repoPathOf("vendor/lib"), detail: "EISDIR: illegal operation on a directory" },
          ],
        },
      }),
    ).toEqual({
      code: 0,
      text: "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/debt/loop-keyword.json\nrewrote eslint.config.mjs\nrewrote packages/a/eslint.config.mjs\nremoved discipline-exceptions/cd-15.json\nremoved disciplines.json\nremoved discipline-exceptions\nfile-carve-out CD-15#loops src/a.ts -> debt loop-keyword#loops\nauthorised-location CD-15#loops src/b.ts -> authorised-location loop-keyword#loops\ncarried loop-keyword#loops src/b.ts\nmention .github/workflows/ci.yml:12\nmention package.json:4\nmention-unread vendor/lib EISDIR: illegal operation on a directory\nupgrade: same findings (3) and verdict as this Hone's version 1 check, not your installed 1.x\n",
    });
  });

  it("names the outside party a carried authorised location binds", () => {
    const outcome = upgradeSuccessOutcomeOf({
      repoRoot: REPO,
      path: PATH,
      carried: {
        written: [repoPathOf("hone.config.json")],
        replaced: [],
        removed: { files: [absoluteRootOf("/repo/disciplines.json")], folders: [] },
        records: [
          {
            recordKind: "authorised-location",
            clause: LOOPS_CLAUSE,
            file: repoPathOf("src/adapters/ids.ts"),
            newKind: "authorised-location",
            check: LOOP_KEYWORD_LOOPS,
            holding: "carried",
            outsideParty: "uuid",
          },
        ],
        findings: 0,
        mentions: [],
        unread: [],
      },
    });

    expect(outcome).toEqual({
      code: 0,
      text: "upgraded to version 2\nwrote hone.config.json\nremoved disciplines.json\nauthorised-location CD-15#loops src/adapters/ids.ts -> authorised-location loop-keyword#loops for uuid\ncarried loop-keyword#loops src/adapters/ids.ts\nupgrade: same findings (0) and verdict as this Hone's version 1 check, not your installed 1.x\n",
    });
  });

  it("names no rewrite when the repository had no team config", () => {
    expect(
      upgradeSuccessOutcomeOf({
        repoRoot: REPO,
        path: PATH,
        carried: {
          written: [repoPathOf("hone.config.json")],
          replaced: [],
          removed: { files: [absoluteRootOf("/repo/disciplines.json")], folders: [] },
          records: [],
          findings: 0,
          mentions: [],
          unread: [],
        },
      }),
    ).toEqual({
      code: 0,
      text: "upgraded to version 2\nwrote hone.config.json\nremoved disciplines.json\nupgrade: same findings (0) and verdict as this Hone's version 1 check, not your installed 1.x\n",
    });
  });

  it("names a clause-wide carve-out's reason, then each check of its clause it now leaves not adopted", () => {
    expect(
      upgradeSuccessOutcomeOf({
        repoRoot: REPO,
        path: PATH,
        carried: {
          written: [repoPathOf("hone.config.json")],
          replaced: [],
          removed: { files: [absoluteRootOf("/repo/disciplines.json")], folders: [] },
          records: [
            {
              recordKind: "clause-wide-carve-out",
              clause: LOOPS_CLAUSE,
              reason: "the tests are\ngenerated  by a tool",
            },
            {
              recordKind: "clause-wide-carve-out",
              clause: LOOPS_CLAUSE,
              newKind: "not-adopted",
              check: REBINDING_LOOPS,
            },
            {
              recordKind: "clause-wide-carve-out",
              clause: LOOPS_CLAUSE,
              newKind: "not-adopted",
              check: LOOP_KEYWORD_LOOPS,
            },
          ],
          findings: 0,
          mentions: [],
          unread: [],
        },
      }),
    ).toEqual({
      code: 0,
      text: "upgraded to version 2\nwrote hone.config.json\nremoved disciplines.json\nreason CD-15#loops: the tests are generated by a tool\nclause-wide-carve-out CD-15#loops -> not-adopted rebinding#loops\nclause-wide-carve-out CD-15#loops -> not-adopted loop-keyword#loops\nupgrade: same findings (0) and verdict as this Hone's version 1 check, not your installed 1.x\n",
    });
  });
});

describe("mapCurrentNamesUpgradeToOutcome", () => {
  it("says the repository is already on version 2 when nothing used a former name", () => {
    const upgrade = { outcome: "renamed", records: [], checks: [] } as const;

    const outcome = mapCurrentNamesUpgradeToOutcome({ upgrade, repoRoot: REPO, path: PATH });

    expect(outcome).toEqual({ code: 0, text: "already on version 2; nothing to upgrade\n" });
  });

  it("names each settings key it renamed, then each records file it moved and each it renamed in place, exit 0", () => {
    const upgrade = {
      outcome: "renamed",
      checks: [
        {
          under: "checks",
          from: "export-from-a-test-file#test-file-export",
          to: "export-from-a-test#test-file-export",
        },
      ],
      records: [
        {
          from: repoPathOf("hone-records/debt/export-from-a-test-file.json"),
          to: repoPathOf("hone-records/debt/export-from-a-test.json"),
          records: 3,
        },
        {
          from: repoPathOf("hone-records/debt/port-outside-the-domain.json"),
          to: repoPathOf("hone-records/debt/port-beside-its-adapter.json"),
          records: 1,
        },
        {
          from: repoPathOf("hone-records/debt/claimed-type.json"),
          to: repoPathOf("hone-records/debt/claimed-type.json"),
          records: 1,
        },
      ],
    } as const;

    const outcome = mapCurrentNamesUpgradeToOutcome({ upgrade, repoRoot: REPO, path: PATH });

    expect(outcome).toEqual({
      code: 0,
      text: "renamed hone.config.json checks export-from-a-test-file#test-file-export -> export-from-a-test#test-file-export\nrenamed hone-records/debt/export-from-a-test-file.json -> hone-records/debt/export-from-a-test.json (3 records)\nrenamed hone-records/debt/port-outside-the-domain.json -> hone-records/debt/port-beside-its-adapter.json (1 record)\nrenamed the records in hone-records/debt/claimed-type.json to the current names\n",
    });
  });

  it.each([
    {
      name: "a file it could not write",
      failure: {
        kind: "unwritable",
        path: absoluteRootOf("/repo/hone.config.json"),
        detail: "EACCES",
      },
      text: "could not write hone.config.json: EACCES; nothing was changed\n",
    },
    {
      name: "a file it could not remove",
      failure: {
        kind: "unremovable",
        path: absoluteRootOf("/repo/hone-records/debt/export-from-a-test-file.json"),
        detail: "EBUSY",
      },
      text: "could not remove hone-records/debt/export-from-a-test-file.json: EBUSY; nothing was changed\n",
    },
    {
      name: "a file that already exists",
      failure: {
        kind: "path-already-exists",
        path: absoluteRootOf("/repo/hone-records/debt/export-from-a-test.json"),
      },
      text: "could not write hone-records/debt/export-from-a-test.json: it already exists; nothing was changed\n",
    },
    {
      name: "a file it could not read to replace",
      failure: {
        kind: "replaced-file-unreadable",
        path: absoluteRootOf("/repo/hone.config.json"),
        detail: "EACCES",
      },
      text: "could not read hone.config.json: EACCES; nothing was changed\n",
    },
    {
      name: "a folder it could not create",
      failure: {
        kind: "directory-uncreatable",
        path: absoluteRootOf("/repo/hone-records/debt"),
        detail: "EACCES",
      },
      text: "could not create hone-records/debt: EACCES; nothing was changed\n",
    },
  ] as const)(
    "names $name, relative to the repository, and says nothing was changed when every write was put back",
    ({ failure, text }) => {
      const upgrade = { outcome: "unwritten", failure } as const;

      const outcome = mapCurrentNamesUpgradeToOutcome({ upgrade, repoRoot: REPO, path: PATH });

      expect(outcome).toEqual({ code: 2, text });
    },
  );

  it("names each file it could not put back, relative to the repository, and says a second upgrade finishes the move", () => {
    const upgrade = {
      outcome: "unrestored",
      failure: {
        kind: "unwritable",
        path: absoluteRootOf("/repo/hone.config.json"),
        detail: "EACCES",
      },
      unrestored: [
        {
          written: "file-removed",
          path: absoluteRootOf("/repo/hone-records/debt/export-from-a-test-file.json"),
          detail: "EBUSY",
        },
      ],
    } as const;

    const outcome = mapCurrentNamesUpgradeToOutcome({ upgrade, repoRoot: REPO, path: PATH });

    expect(outcome).toEqual({
      code: 2,
      text: "could not write hone.config.json: EACCES, and these files could not be put back:\n  hone-records/debt/export-from-a-test-file.json (EBUSY)\na second hone upgrade finishes the move\n",
    });
  });
});
