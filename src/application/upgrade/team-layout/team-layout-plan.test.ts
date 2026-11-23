import { describe, expect, it } from "vitest";

import { catalogueNameOf } from "../../../domain/language-layer/catalogue-name.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { editionOf } from "../../../domain/rule-set/edition-of.ts";
import { ruleSetNameOf } from "../../../domain/rule-set/rule-set-name-of.ts";
import type {
  TeamDefinition,
  VersionOneTeamClause,
  VersionOneTeamLayout,
} from "../../ports/upgrade/version-one-team-layout.ts";
import { teamLayoutPlanOf } from "./team-layout-plan.ts";

const itemTextOf = (request: { readonly title: string; readonly facts: unknown }): string =>
  `${request.title} ${JSON.stringify(request.facts)}`;

const FIRST = editionOf("1");

const CONSOLE_CLAUSE = {
  ruleSet: { name: ruleSetNameOf("acme") },
  discipline: disciplineIdOf("ACME-1"),
  clause: clauseIdOf("console-calls"),
};

const DRAFT_CLAUSE = {
  ruleSet: { name: ruleSetNameOf("acme") },
  discipline: disciplineIdOf("ACME-1"),
  clause: clauseIdOf("draft-calls"),
};

const CONSOLE: VersionOneTeamClause = {
  clause: CONSOLE_CLAUSE,
  naming: {
    naming: "named",
    check: { symptom: catalogueNameOf("direct-console"), check: catalogueNameOf("console-calls") },
    title: "Console calls",
  },
  summary: "no direct console output",
  anchor: { kind: "keyword", keyword: "console" },
  exceptions: "allowed",
  cases: {
    flag: [
      {
        name: "log",
        fileName: repoPathOf("src/a.ts"),
        source: "console.log(1);\n",
        expectedLines: [1],
      },
    ],
    allow: [],
  },
  pieces: [
    {
      mechanism: "eslint",
      settings: { pluginNamespace: "acme", pluginModule: "plugin.ts", rule: "no-console" },
      checkSettings: {},
      editions: { declared: [FIRST], default: FIRST, latest: FIRST },
      folder: repoPathOf("acme/mechanisms/eslint/ACME-1"),
      files: [
        { file: repoPathOf("plugin.ts"), text: "export default {};\n" },
        { file: repoPathOf("helpers/names.ts"), text: "export const names = [];\n" },
      ],
    },
  ],
};

const DRAFT: VersionOneTeamClause = {
  clause: DRAFT_CLAUSE,
  naming: {
    naming: "named",
    check: { symptom: catalogueNameOf("direct-console"), check: catalogueNameOf("draft-calls") },
    title: "Draft calls",
  },
  summary: "no draft output",
  anchor: { kind: "file" },
  exceptions: "refused",
  cases: { flag: [], allow: [] },
  pieces: [],
};

const PRINCIPLE: TeamDefinition = {
  kind: "principle",
  name: "repository-ready",
  title: "Repository ready",
  facts: {},
  refers: [],
};

const CASE: TeamDefinition = {
  kind: "case",
  name: "changes-a-repository",
  title: "Changes a repository",
  facts: { standing: "accepted", owes: [{ principle: "repository-ready" }] },
  refers: [{ kind: "principle", name: "repository-ready" }],
};

const SYMPTOM: TeamDefinition = {
  kind: "symptom",
  name: "direct-console",
  title: "Direct console",
  facts: { group: "Repository health" },
  refers: [
    { kind: "case", name: "changes-a-repository" },
    { kind: "principle", name: "repository-ready" },
  ],
};

const LAYOUT: VersionOneTeamLayout = {
  ruleSet: { name: ruleSetNameOf("acme") },
  location: { location: "folder", path: repoPathOf("acme") },
  namesFile: repoPathOf("acme/version-two-names.json"),
  clauses: [CONSOLE, DRAFT],
  definitions: [PRINCIPLE, CASE, SYMPTOM],
  versionOneFiles: [
    repoPathOf("acme/rules/ACME-1/discipline.json"),
    repoPathOf("acme/mechanisms/eslint/ACME-1/piece.json"),
  ],
};

const DEBT = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "none-yet" } as const;

describe("teamLayoutPlanOf", () => {
  it("writes the team's definitions, the symptom seen as its clauses' summaries, a check per clause, and each piece's whole folder with its examples, and removes the version 1 files and the folders they leave deepest first", () => {
    expect(teamLayoutPlanOf({ layouts: [LAYOUT], recordKinds: [DEBT], itemTextOf })).toEqual({
      outcome: "ok",
      value: {
        files: [
          { file: "acme/rules/principles/repository-ready.md", text: "Repository ready {}" },
          {
            file: "acme/rules/cases/changes-a-repository.md",
            text: 'Changes a repository {"standing":"accepted","owes":[{"principle":"repository-ready"}]}',
          },
          {
            file: "acme/rules/typescript/symptoms/direct-console.md",
            text: 'Direct console {"group":"Repository health","seen":"no direct console output; no draft output"}',
          },
          { file: "acme/rules/record-kinds/debt.md", text: 'Debt {"phrase":"debt"}' },
          {
            file: "acme/rules/typescript/symptoms/direct-console/console-calls.md",
            text: "Console calls {}",
          },
          {
            file: "acme/rules/typescript/symptoms/direct-console/draft-calls.md",
            text: "Draft calls {}",
          },
          {
            file: "acme/engines/eslint/direct-console/console-calls/piece.json",
            text: '{\n  "version": 2,\n  "exceptions": "allowed",\n  "checkSettings": {},\n  "anchor": {\n    "kind": "keyword",\n    "keyword": "console"\n  },\n  "settings": {\n    "pluginNamespace": "acme",\n    "pluginModule": "plugin.ts",\n    "rule": "no-console"\n  },\n  "editions": [\n    "1"\n  ]\n}\n',
          },
          {
            file: "acme/engines/eslint/direct-console/console-calls/console-calls.examples.json",
            text: '{\n  "flag": [\n    {\n      "name": "log",\n      "fileName": "src/a.ts",\n      "source": "console.log(1);\\n",\n      "expectedLines": [\n        1\n      ]\n    }\n  ],\n  "allow": []\n}\n',
          },
          {
            file: "acme/engines/eslint/direct-console/console-calls/plugin.ts",
            text: "export default {};\n",
          },
          {
            file: "acme/engines/eslint/direct-console/console-calls/helpers/names.ts",
            text: "export const names = [];\n",
          },
        ],
        removed: [
          "acme/rules/ACME-1/discipline.json",
          "acme/mechanisms/eslint/ACME-1/piece.json",
          "acme/mechanisms/eslint/ACME-1/plugin.ts",
          "acme/mechanisms/eslint/ACME-1/helpers/names.ts",
          "acme/version-two-names.json",
        ],
        folders: [
          "acme/mechanisms/eslint/ACME-1/helpers",
          "acme/mechanisms/eslint/ACME-1",
          "acme/rules/ACME-1",
          "acme/mechanisms/eslint",
          "acme/rules",
          "acme/mechanisms",
        ],
      },
    });
  });

  it("places the layout of a rule set kept at the repository root at the root", () => {
    expect(
      teamLayoutPlanOf({
        layouts: [{ ...LAYOUT, location: { location: "repo-root" }, clauses: [] }],
        recordKinds: [],
        itemTextOf,
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        files: [
          { file: "rules/principles/repository-ready.md", text: "Repository ready {}" },
          { file: "rules/cases/changes-a-repository.md" },
          { file: "rules/typescript/symptoms/direct-console.md" },
        ],
      },
    });
  });

  it("refuses every unnamed clause and every definition the named clauses need but the names file lacks, of every rule set, together", () => {
    expect(
      teamLayoutPlanOf({
        layouts: [
          {
            ...LAYOUT,
            clauses: [{ ...CONSOLE, naming: { naming: "unnamed" } }, DRAFT],
            definitions: [SYMPTOM],
          },
          {
            ...LAYOUT,
            ruleSet: { name: ruleSetNameOf("docs") },
            namesFile: repoPathOf("docs/version-two-names.json"),
            clauses: [{ ...DRAFT, naming: { naming: "unnamed" } }],
            definitions: [],
          },
        ],
        recordKinds: [],
        itemTextOf,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "team-names-missing",
        missing: [
          { missing: "clause", clause: CONSOLE_CLAUSE, namesFile: "acme/version-two-names.json" },
          {
            missing: "definition",
            definition: { kind: "case", name: "changes-a-repository" },
            namesFile: "acme/version-two-names.json",
          },
          {
            missing: "definition",
            definition: { kind: "principle", name: "repository-ready" },
            namesFile: "acme/version-two-names.json",
          },
          { missing: "clause", clause: DRAFT_CLAUSE, namesFile: "docs/version-two-names.json" },
        ],
      },
    });
  });

  it("refuses a symptom a named clause sees that the names file does not define", () => {
    expect(
      teamLayoutPlanOf({
        layouts: [{ ...LAYOUT, definitions: [PRINCIPLE, CASE] }],
        recordKinds: [],
        itemTextOf,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "team-names-missing",
        missing: [
          {
            missing: "definition",
            definition: { kind: "symptom", name: "direct-console" },
            namesFile: "acme/version-two-names.json",
          },
        ],
      },
    });
  });

  it("writes nothing and removes nothing when no rule set needs converting", () => {
    expect(teamLayoutPlanOf({ layouts: [], recordKinds: [DEBT], itemTextOf })).toEqual({
      outcome: "ok",
      value: { files: [], removed: [], folders: [] },
    });
  });
});
