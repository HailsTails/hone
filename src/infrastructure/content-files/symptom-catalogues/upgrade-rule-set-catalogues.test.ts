import { describe, expect, it, vi } from "vitest";

import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../../domain/rule-set/rule-set-name-of.ts";
import type { ConsumerSelectionFile } from "../../../domain/settings/selection/selection-file.ts";
import { createPathPort } from "../../node/path-port.ts";
import { upgradeRuleSetCataloguesOf } from "./upgrade-rule-set-catalogues.ts";

const NAMES_PATH = "/repo/acme/version-two-names.json";

const SELECTION: ConsumerSelectionFile = {
  version: 1,
  ruleSets: [[ruleSetNameOf("acme"), { location: "folder", path: repoPathOf("acme") }]],
  clauses: [],
  exclude: [],
  eslintConfigRoots: [],
  fileExceptionWhyChains: "required",
  reportOutput: "full",
  assessment: { forfeiture: "this-run" },
  clauseSettings: [],
  checkEditions: "pinned",
};

const USING_ACME: ConsumerSelectionFile = {
  ...SELECTION,
  clauses: [
    [
      {
        ruleSet: { name: ruleSetNameOf("acme") },
        discipline: disciplineIdOf("ACME-1"),
        clause: clauseIdOf("console-calls"),
      },
      { state: "run", mechanism: "eslint" },
    ],
  ],
};

const sourcesOver = (request: {
  readonly fileText: FileTextPort;
  readonly selection: ConsumerSelectionFile;
}) => ({
  ...request,
  directory: {
    list: vi.fn<DirectoryPort["list"]>().mockReturnValue({ outcome: "ok", value: [] }),
    create: vi.fn<DirectoryPort["create"]>(),
  },
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
  repoRoot: absoluteRootOf("/repo"),
  installRoot: absoluteRootOf("/install"),
});

describe("upgradeRuleSetCataloguesOf", () => {
  it("reads no catalogue when the selection uses no team rule set", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>(),
      read: vi.fn<FileTextPort["read"]>(),
      write: vi.fn<FileTextPort["write"]>(),
    };
    expect(upgradeRuleSetCataloguesOf(sourcesOver({ fileText, selection: SELECTION }))).toEqual({
      outcome: "ok",
      value: [],
    });
    expect(fileText.read).not.toHaveBeenCalled();
  });

  it("refuses at the team's names file when it is malformed", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
      read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: "{" }),
      write: vi.fn<FileTextPort["write"]>(),
    };
    expect(
      upgradeRuleSetCataloguesOf(sourcesOver({ fileText, selection: USING_ACME })),
    ).toMatchObject({ outcome: "failed", error: { kind: "file-malformed", path: NAMES_PATH } });
  });
});
