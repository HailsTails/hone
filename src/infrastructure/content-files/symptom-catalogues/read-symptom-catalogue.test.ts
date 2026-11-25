import { describe, expect, it, vi } from "vitest";

import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type {
  Case,
  CatalogueContent,
  Engine,
  Principle,
  RecordKind,
  Symptom,
  AuthorisedLocationKind,
  UnboundRecordKind,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../../domain/rule-set/rule-set-name-of.ts";
import { createPathPort } from "../../node/path-port.ts";
import { createSymptomCatalogueRepository } from "./read-symptom-catalogue.ts";

const INSTALL_ROOT = absoluteRootOf("/install");

const TEAM_ROOT = absoluteRootOf("/repo/team-rules");

const TEAM = { name: ruleSetNameOf("team") };

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/install" });

const NAMES_PATH = "/install/src/infrastructure/disciplines-file/version-one-names.json";

const NAMES_TEXT =
  '{ "version": 1, "clauses": [{ "clause": "CD-44#parameter-reassignment", "sight": { "kind": "one-symptom", "symptom": "rebinding" }, "checks": ["rebinding#parameter-reassignment"], "anchor": { "kind": "file" } }], "recordKinds": { "authorised-location": "authorised-location", "debt": "file-carve-out" } }';

const MAKES_A_NEW_VALUE_TEXT =
  '# Makes a new value from what it has\n\n```json\n{ "standing": "accepted", "owes": [{ "principle": "no-hidden-effects" }] }\n```\n';

const NO_HIDDEN_EFFECTS_TEXT = "# No hidden effects\n\n```json\n{}\n```\n";

const AUTHORISED_LOCATION_TEXT =
  '# Authorised location\n\n```json\n{ "phrase": "an authorised location" }\n```\n';

const DEBT_TEXT = '# Debt\n\n```json\n{ "phrase": "debt" }\n```\n';

const REBINDING_TEXT =
  '# Rebinding\n\n```json\n{ "group": "Effects and state", "seen": "A `let` assigned again.", "mayIndicate": [{ "case": "makes-a-new-value-from-what-it-has", "points": [{ "principle": "no-hidden-effects" }] }], "breachUsuallySits": "in the unit", "seenBy": ["syntax"], "recipes": [], "correctUses": [] }\n```\n';

const PARAMETER_REASSIGNMENT_TEXT = "# parameter-reassignment\n\n```json\n{}\n```\n";

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const AUTHORISED_LOCATION: AuthorisedLocationKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const DEBT: UnboundRecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const MAKES_A_NEW_VALUE: Case = {
  name: "makes-a-new-value-from-what-it-has",
  title: "Makes a new value from what it has",
  standing: "accepted",
  owes: [{ kind: "principle", principle: NO_HIDDEN_EFFECTS }],
};

const WALKER: Engine = { name: "walker" };

const ESLINT: Engine = { name: "eslint" };

const PARAMETER_REASSIGNMENT = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-44"),
  clause: clauseIdOf("parameter-reassignment"),
};

const REBINDING: Symptom = {
  ruleSet: "hone",
  name: "rebinding",
  title: "Rebinding",
  seen: "A `let` assigned again.",
  mayIndicate: [
    { case: MAKES_A_NEW_VALUE, points: [{ kind: "principle", principle: NO_HIDDEN_EFFECTS }] },
  ],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const UNLISTED: DirectoryPort = {
  list: vi.fn<DirectoryPort["list"]>(),
  create: vi.fn<DirectoryPort["create"]>(),
};

const ITEM_FOLDER_FILE_TEXT: FileTextPort = {
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  read: vi
    .fn<FileTextPort["read"]>()
    .mockReturnValueOnce({ outcome: "ok", value: NAMES_TEXT })
    .mockReturnValueOnce({ outcome: "ok", value: MAKES_A_NEW_VALUE_TEXT })
    .mockReturnValueOnce({ outcome: "ok", value: NO_HIDDEN_EFFECTS_TEXT })
    .mockReturnValueOnce({ outcome: "ok", value: AUTHORISED_LOCATION_TEXT })
    .mockReturnValueOnce({ outcome: "ok", value: DEBT_TEXT })
    .mockReturnValueOnce({ outcome: "ok", value: REBINDING_TEXT })
    .mockReturnValueOnce({ outcome: "ok", value: PARAMETER_REASSIGNMENT_TEXT }),
  write: vi.fn<FileTextPort["write"]>(),
};
const ITEM_FOLDER_DIRECTORY: DirectoryPort = {
  list: vi
    .fn<DirectoryPort["list"]>()
    .mockReturnValueOnce({
      outcome: "ok",
      value: [
        { name: "cases", kind: "directory" },
        { name: "principles", kind: "directory" },
        { name: "record-kinds", kind: "directory" },
        { name: "typescript", kind: "directory" },
      ],
    })
    .mockReturnValueOnce({
      outcome: "ok",
      value: [{ name: "makes-a-new-value-from-what-it-has.md", kind: "file" }],
    })
    .mockReturnValueOnce({ outcome: "ok", value: [{ name: "no-hidden-effects.md", kind: "file" }] })
    .mockReturnValueOnce({
      outcome: "ok",
      value: [
        { name: "authorised-location.md", kind: "file" },
        { name: "debt.md", kind: "file" },
      ],
    })
    .mockReturnValueOnce({ outcome: "ok", value: [{ name: "symptoms", kind: "directory" }] })
    .mockReturnValueOnce({
      outcome: "ok",
      value: [
        { name: "rebinding", kind: "directory" },
        { name: "rebinding.md", kind: "file" },
      ],
    })
    .mockReturnValueOnce({
      outcome: "ok",
      value: [{ name: "parameter-reassignment.md", kind: "file" }],
    }),
  create: vi.fn<DirectoryPort["create"]>(),
};

describe("createSymptomCatalogueRepository", () => {
  it("reads the items under the rule set's rules folder, with the clauses and formats of today the version 1 names give and the engines the registry names", () => {
    expect(
      createSymptomCatalogueRepository({
        fileText: ITEM_FOLDER_FILE_TEXT,
        directory: ITEM_FOLDER_DIRECTORY,
        path: PATH,
        ruleSetRoot: INSTALL_ROOT,
        ruleSet: "hone",
        installRoot: INSTALL_ROOT,
        inheritedRecordKinds: [],
      }).read({}),
    ).toEqual({
      outcome: "ok",
      value: {
        held: "catalogue",
        content: {
          principles: [NO_HIDDEN_EFFECTS],
          rules: [],
          cases: [MAKES_A_NEW_VALUE],
          recipes: [],
          recordKinds: [AUTHORISED_LOCATION, DEBT],
          engines: [WALKER, ESLINT],
          symptoms: [REBINDING],
          clauses: [
            {
              clause: PARAMETER_REASSIGNMENT,
              sight: { kind: "one-symptom", symptom: { ruleSet: "hone", name: "rebinding" } },
            },
          ],
          checks: [
            {
              name: "parameter-reassignment",
              symptom: { ruleSet: "hone", name: "rebinding" },
              page: "rebinding/parameter-reassignment.md",
              clause: PARAMETER_REASSIGNMENT,
              forms: [],
              findingSpecifics: [],
            },
          ],
          namedBans: [],
        },
      },
    });
    expect(ITEM_FOLDER_FILE_TEXT.read).toHaveBeenNthCalledWith(1, { path: NAMES_PATH });
    expect(ITEM_FOLDER_DIRECTORY.list).toHaveBeenNthCalledWith(1, { path: "/install/rules" });
    expect(ITEM_FOLDER_FILE_TEXT.write).not.toHaveBeenCalled();
  });
});

const TEAM_CLAUSE = {
  ruleSet: TEAM,
  discipline: disciplineIdOf("TM-1"),
  clause: clauseIdOf("reassigned"),
};

const CONTENT_NAMED_BY_THE_TEAM: CatalogueContent = {
  principles: [NO_HIDDEN_EFFECTS],
  rules: [],
  cases: [MAKES_A_NEW_VALUE],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION, DEBT],
  engines: [WALKER, ESLINT],
  symptoms: [{ ...REBINDING, ruleSet: TEAM, sourceFile: "rules/typescript/symptoms/rebinding.md" }],
  clauses: [
    {
      clause: TEAM_CLAUSE,
      sight: { kind: "one-symptom", symptom: { ruleSet: TEAM, name: "rebinding" } },
    },
  ],
  checks: [
    {
      name: "reassigned",
      symptom: { ruleSet: TEAM, name: "rebinding" },
      page: "rules/typescript/symptoms/rebinding/reassigned.md",
      clause: TEAM_CLAUSE,
      forms: [],
      findingSpecifics: [],
    },
  ],
  namedBans: [],
};

const teamCatalogueOf = (request: {
  readonly fileText: FileTextPort;
  readonly directory: DirectoryPort;
}) =>
  createSymptomCatalogueRepository({
    ...request,
    path: PATH,
    ruleSetRoot: TEAM_ROOT,
    ruleSet: TEAM,
    installRoot: INSTALL_ROOT,
    inheritedRecordKinds: [AUTHORISED_LOCATION, DEBT],
  }).read({});

describe("createSymptomCatalogueRepository over a team's rule set", () => {
  it("reads a symptom kept under a language folder other than typescript as the team's, naming its page by where it sits, with the record kinds it inherits as its own", () => {
    const fileText: FileTextPort = {
      exists: vi
        .fn<FileTextPort["exists"]>()
        .mockReturnValueOnce("present")
        .mockReturnValueOnce("absent"),
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({ outcome: "ok", value: MAKES_A_NEW_VALUE_TEXT })
        .mockReturnValueOnce({ outcome: "ok", value: NO_HIDDEN_EFFECTS_TEXT })
        .mockReturnValueOnce({ outcome: "ok", value: REBINDING_TEXT })
        .mockReturnValueOnce({ outcome: "ok", value: PARAMETER_REASSIGNMENT_TEXT }),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const directory: DirectoryPort = {
      list: vi
        .fn<DirectoryPort["list"]>()
        .mockReturnValueOnce({
          outcome: "ok",
          value: [
            { name: "cases", kind: "directory" },
            { name: "principles", kind: "directory" },
            { name: "sql", kind: "directory" },
          ],
        })
        .mockReturnValueOnce({
          outcome: "ok",
          value: [{ name: "makes-a-new-value-from-what-it-has.md", kind: "file" }],
        })
        .mockReturnValueOnce({
          outcome: "ok",
          value: [{ name: "no-hidden-effects.md", kind: "file" }],
        })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "symptoms", kind: "directory" }] })
        .mockReturnValueOnce({
          outcome: "ok",
          value: [
            { name: "rebinding", kind: "directory" },
            { name: "rebinding.md", kind: "file" },
          ],
        })
        .mockReturnValueOnce({
          outcome: "ok",
          value: [{ name: "parameter-reassignment.md", kind: "file" }],
        }),
      create: vi.fn<DirectoryPort["create"]>(),
    };

    expect(teamCatalogueOf({ fileText, directory })).toMatchObject({
      outcome: "ok",
      value: {
        held: "catalogue",
        content: {
          recordKinds: [AUTHORISED_LOCATION, DEBT],
          symptoms: [{ name: "rebinding", sourceFile: "rules/sql/symptoms/rebinding.md" }],
          checks: [
            {
              name: "parameter-reassignment",
              symptom: { ruleSet: TEAM, name: "rebinding" },
            },
          ],
        },
      },
    });
    expect(fileText.read).toHaveBeenNthCalledWith(3, {
      path: "/repo/team-rules/rules/sql/symptoms/rebinding.md",
    });
  });

  it("gives a check the clause the team's own version 1 names give it", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({
          outcome: "ok",
          value:
            '{ "version": 1, "clauses": [{ "clause": "team/TM-1#reassigned", "sight": { "kind": "one-symptom", "symptom": "rebinding" }, "checks": ["rebinding#reassigned"], "anchor": { "kind": "file" } }], "recordKinds": {} }',
        })
        .mockReturnValueOnce({ outcome: "ok", value: MAKES_A_NEW_VALUE_TEXT })
        .mockReturnValueOnce({ outcome: "ok", value: NO_HIDDEN_EFFECTS_TEXT })
        .mockReturnValueOnce({ outcome: "ok", value: REBINDING_TEXT })
        .mockReturnValueOnce({ outcome: "ok", value: PARAMETER_REASSIGNMENT_TEXT }),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const directory: DirectoryPort = {
      list: vi
        .fn<DirectoryPort["list"]>()
        .mockReturnValueOnce({
          outcome: "ok",
          value: [
            { name: "cases", kind: "directory" },
            { name: "principles", kind: "directory" },
            { name: "typescript", kind: "directory" },
          ],
        })
        .mockReturnValueOnce({
          outcome: "ok",
          value: [{ name: "makes-a-new-value-from-what-it-has.md", kind: "file" }],
        })
        .mockReturnValueOnce({
          outcome: "ok",
          value: [{ name: "no-hidden-effects.md", kind: "file" }],
        })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "symptoms", kind: "directory" }] })
        .mockReturnValueOnce({
          outcome: "ok",
          value: [
            { name: "rebinding", kind: "directory" },
            { name: "rebinding.md", kind: "file" },
          ],
        })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "reassigned.md", kind: "file" }] }),
      create: vi.fn<DirectoryPort["create"]>(),
    };

    const read = teamCatalogueOf({ fileText, directory });

    expect([read, vi.mocked(fileText.read).mock.calls[0]]).toEqual([
      { outcome: "ok", value: { held: "catalogue", content: CONTENT_NAMED_BY_THE_TEAM } },
      [{ path: "/repo/team-rules/rules/version-one-names.json" }],
    ]);
  });

  it("fails file-malformed at the team's version 1 names when they are malformed", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({ outcome: "ok", value: '{ "version": 1, "clauses": [] }' }),
      write: vi.fn<FileTextPort["write"]>(),
    };

    const read = teamCatalogueOf({ fileText, directory: UNLISTED });

    expect(read).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: "/repo/team-rules/rules/version-one-names.json",
        detail: "✖ Invalid input: expected record, received undefined\n  → at recordKinds",
      },
    });
  });

  it("fails rule-set-not-upgraded naming the rule set when its rules folder still holds version 1 discipline files and no items", () => {
    const fileText: FileTextPort = {
      exists: vi
        .fn<FileTextPort["exists"]>()
        .mockReturnValueOnce("present")
        .mockReturnValueOnce("absent")
        .mockReturnValueOnce("present"),
      read: vi.fn<FileTextPort["read"]>(),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const directory: DirectoryPort = {
      list: vi
        .fn<DirectoryPort["list"]>()
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "ACME-1", kind: "directory" }] })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "discipline.json", kind: "file" }] })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "ACME-1", kind: "directory" }] }),
      create: vi.fn<DirectoryPort["create"]>(),
    };

    expect(teamCatalogueOf({ fileText, directory })).toEqual({
      outcome: "failed",
      error: { kind: "rule-set-not-upgraded", path: TEAM_ROOT },
    });
    expect(fileText.exists).toHaveBeenLastCalledWith({
      path: "/repo/team-rules/rules/ACME-1/discipline.json",
    });
  });

  it("holds no catalogue when its rules folder holds neither items nor version 1 discipline files", () => {
    const fileText: FileTextPort = {
      exists: vi
        .fn<FileTextPort["exists"]>()
        .mockReturnValueOnce("present")
        .mockReturnValueOnce("absent"),
      read: vi.fn<FileTextPort["read"]>(),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const directory: DirectoryPort = {
      list: vi
        .fn<DirectoryPort["list"]>()
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "drafts", kind: "directory" }] })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "notes.txt", kind: "file" }] })
        .mockReturnValueOnce({ outcome: "ok", value: [{ name: "drafts", kind: "directory" }] }),
      create: vi.fn<DirectoryPort["create"]>(),
    };

    expect(teamCatalogueOf({ fileText, directory })).toEqual({
      outcome: "ok",
      value: { held: "none" },
    });
    expect(fileText.exists).toHaveBeenLastCalledWith({
      path: "/repo/team-rules/rules/drafts/discipline.json",
    });
  });

  it("fails file-unreadable naming the rules folder when it cannot list it to look for version 1 discipline files", () => {
    const fileText: FileTextPort = {
      exists: vi
        .fn<FileTextPort["exists"]>()
        .mockReturnValueOnce("present")
        .mockReturnValueOnce("absent"),
      read: vi.fn<FileTextPort["read"]>(),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const directory: DirectoryPort = {
      list: vi
        .fn<DirectoryPort["list"]>()
        .mockReturnValueOnce({ outcome: "ok", value: [] })
        .mockReturnValueOnce({
          outcome: "failed",
          error: {
            kind: "directory-unreadable",
            path: absoluteRootOf("/repo/team-rules/rules"),
            detail: "EACCES",
          },
        }),
      create: vi.fn<DirectoryPort["create"]>(),
    };

    expect(teamCatalogueOf({ fileText, directory })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: "/repo/team-rules/rules", detail: "EACCES" },
    });
  });
});
