import { describe, expect, it, vi } from "vitest";

import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type {
  Case,
  Engine,
  Principle,
  RecordKind,
  Symptom,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { createPathPort } from "../../node/path-port.ts";
import { createSymptomCatalogueRepository } from "./read-symptom-catalogue.ts";

const INSTALL_ROOT = absoluteRootOf("/install");

const TEAM_ROOT = absoluteRootOf("/repo/team-rules");

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

const AUTHORISED_LOCATION: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const DEBT: RecordKind = {
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
        installRoot: INSTALL_ROOT,
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
            { clause: PARAMETER_REASSIGNMENT, sight: { kind: "one-symptom", symptom: REBINDING } },
          ],
          checks: [
            {
              name: "parameter-reassignment",
              symptom: REBINDING,
              clause: PARAMETER_REASSIGNMENT,
              forms: [],
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

  it("holds no catalogue, reading nothing, when a team's rule set holds no rules folder, since version 1 names are Hone's own", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
      read: vi.fn<FileTextPort["read"]>(),
      write: vi.fn<FileTextPort["write"]>(),
    };
    expect(
      createSymptomCatalogueRepository({
        fileText,
        directory: UNLISTED,
        path: PATH,
        ruleSetRoot: TEAM_ROOT,
        installRoot: INSTALL_ROOT,
      }).read({}),
    ).toEqual({
      outcome: "ok",
      value: { held: "none" },
    });
    expect(fileText.read).not.toHaveBeenCalled();
  });

  it("fails file-unreadable naming the version 1 names when Hone's own install is missing them", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
      read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({
        outcome: "failed",
        error: { kind: "unreadable", path: NAMES_PATH, detail: "ENOENT" },
      }),
      write: vi.fn<FileTextPort["write"]>(),
    };
    expect(
      createSymptomCatalogueRepository({
        fileText,
        directory: UNLISTED,
        path: PATH,
        ruleSetRoot: INSTALL_ROOT,
        installRoot: INSTALL_ROOT,
      }).read({}),
    ).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: NAMES_PATH, detail: "ENOENT" },
    });
  });

  it("fails file-unreadable naming the version 1 names when they cannot be read", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
      read: vi.fn<FileTextPort["read"]>().mockReturnValue({
        outcome: "failed",
        error: { kind: "unreadable", path: NAMES_PATH, detail: "EACCES" },
      }),
      write: vi.fn<FileTextPort["write"]>(),
    };
    expect(
      createSymptomCatalogueRepository({
        fileText,
        directory: UNLISTED,
        path: PATH,
        ruleSetRoot: INSTALL_ROOT,
        installRoot: INSTALL_ROOT,
      }).read({}),
    ).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: NAMES_PATH, detail: "EACCES" },
    });
    expect(UNLISTED.list).not.toHaveBeenCalled();
  });
});
