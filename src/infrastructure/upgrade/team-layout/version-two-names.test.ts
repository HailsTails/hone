import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import { readVersionTwoNames } from "./version-two-names.ts";

const PATH = "/repo/acme/version-two-names.json";

const holding = (text: string): FileTextPort => ({
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: text }),
  write: vi.fn<FileTextPort["write"]>(),
});

const NAMES = `{
  "clauses": {
    "ACME-1#console-calls": { "check": "direct-console#console-calls", "title": "Console calls" }
  },
  "symptoms": {
    "direct-console": {
      "title": "Direct console",
      "group": "Repository health",
      "mayIndicate": [{ "case": "changes-a-repository", "points": [{ "rule": "no-console" }] }],
      "breachUsuallySits": "in the source change",
      "seenBy": ["syntax"],
      "recipes": [],
      "correctUses": []
    }
  },
  "cases": {
    "changes-a-repository": {
      "title": "Changes a repository",
      "standing": "accepted",
      "owes": [{ "principle": "repository-ready" }, { "rule": "no-console" }]
    }
  },
  "principles": { "repository-ready": { "title": "Repository ready" } },
  "rules": {
    "no-console": { "title": "No console", "principle": "repository-ready", "standing": "accepted" }
  }
}`;

describe("readVersionTwoNames", () => {
  it("reads each clause's check and title, and each definition with its facts and what it refers to", () => {
    expect(readVersionTwoNames({ fileText: holding(NAMES), path: PATH })).toEqual({
      outcome: "ok",
      value: {
        clauses: new Map([
          [
            "ACME-1#console-calls",
            {
              check: { symptom: "direct-console", check: "console-calls" },
              title: "Console calls",
            },
          ],
        ]),
        definitions: [
          {
            kind: "principle",
            name: "repository-ready",
            title: "Repository ready",
            facts: {},
            refers: [],
          },
          {
            kind: "rule",
            name: "no-console",
            title: "No console",
            facts: { principle: "repository-ready", standing: "accepted" },
            refers: [{ kind: "principle", name: "repository-ready" }],
          },
          {
            kind: "case",
            name: "changes-a-repository",
            title: "Changes a repository",
            facts: {
              standing: "accepted",
              owes: [{ principle: "repository-ready" }, { rule: "no-console" }],
            },
            refers: [
              { kind: "principle", name: "repository-ready" },
              { kind: "rule", name: "no-console" },
            ],
          },
          {
            kind: "symptom",
            name: "direct-console",
            title: "Direct console",
            facts: {
              group: "Repository health",
              mayIndicate: [{ case: "changes-a-repository", points: [{ rule: "no-console" }] }],
              breachUsuallySits: "in the source change",
              seenBy: ["syntax"],
              recipes: [],
              correctUses: [],
            },
            refers: [
              { kind: "case", name: "changes-a-repository" },
              { kind: "rule", name: "no-console" },
            ],
          },
        ],
      },
    });
  });

  it("names no clause and defines nothing when the rule set holds no names file", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
      read: vi.fn<FileTextPort["read"]>(),
      write: vi.fn<FileTextPort["write"]>(),
    };
    expect(readVersionTwoNames({ fileText, path: PATH })).toEqual({
      outcome: "ok",
      value: { clauses: new Map(), definitions: [] },
    });
    expect(fileText.read).not.toHaveBeenCalled();
  });

  it("refuses a check named by two clauses", () => {
    expect(
      readVersionTwoNames({
        fileText: holding(
          '{ "clauses": { "ACME-1#console-calls": { "check": "direct-console#console-calls", "title": "Console calls" }, "ACME-2#console-calls": { "check": "direct-console#console-calls", "title": "Console calls" } }, "symptoms": {}, "cases": {}, "principles": {}, "rules": {} }',
        ),
        path: PATH,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: PATH,
        detail: "✖ direct-console#console-calls names more than one clause\n  → at clauses",
      },
    });
  });

  it("refuses, before anything is written, a case whose name is not its hyphenated title", () => {
    expect(
      readVersionTwoNames({
        fileText: holding(
          '{ "clauses": {}, "symptoms": {}, "cases": { "changes-a-repo": { "title": "Changes a repository", "standing": "accepted", "owes": [{ "principle": "repository-ready" }] } }, "principles": {}, "rules": {} }',
        ),
        path: PATH,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: PATH,
        detail:
          "✖ cases names changes-a-repo, which its title Changes a repository names changes-a-repository\n  → at cases",
      },
    });
  });

  it("refuses, before anything is written, an indication that points at what its case does not owe", () => {
    expect(
      readVersionTwoNames({
        fileText: holding(
          '{ "clauses": {}, "symptoms": { "direct-console": { "title": "Direct console", "group": "Repository health", "mayIndicate": [{ "case": "changes-a-repository", "points": [{ "rule": "no-console" }] }], "breachUsuallySits": "in the source change", "seenBy": ["syntax"], "recipes": [], "correctUses": [] } }, "cases": { "changes-a-repository": { "title": "Changes a repository", "standing": "accepted", "owes": [{ "principle": "repository-ready" }] } }, "principles": {}, "rules": {} }',
        ),
        path: PATH,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: PATH,
        detail:
          "✖ direct-console points changes-a-repository at no-console, which changes-a-repository does not owe",
      },
    });
  });

  it("names each point of one indication that its case does not owe", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
      read: vi.fn<FileTextPort["read"]>().mockReturnValue({
        outcome: "ok",
        value:
          '{ "clauses": {}, "symptoms": { "direct-console": { "title": "Direct console", "group": "Repository health", "mayIndicate": [{ "case": "changes-a-repository", "points": [{ "rule": "no-console" }, { "principle": "repository-ready" }, { "rule": "no-logging" }] }], "breachUsuallySits": "in the source change", "seenBy": ["syntax"], "recipes": [], "correctUses": [] } }, "cases": { "changes-a-repository": { "title": "Changes a repository", "standing": "accepted", "owes": [{ "principle": "repository-ready" }] } }, "principles": {}, "rules": {} }',
      }),
      write: vi.fn<FileTextPort["write"]>(),
    };

    const names = readVersionTwoNames({ fileText, path: PATH });

    expect(names).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: PATH,
        detail:
          "✖ direct-console points changes-a-repository at no-console, which changes-a-repository does not owe\n✖ direct-console points changes-a-repository at no-logging, which changes-a-repository does not owe",
      },
    });
  });

  it("refuses a key that is no clause", () => {
    expect(
      readVersionTwoNames({
        fileText: holding(
          '{ "clauses": { "console-calls": { "check": "direct-console#console-calls", "title": "Console calls" } }, "symptoms": {}, "cases": {}, "principles": {}, "rules": {} }',
        ),
        path: PATH,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: PATH,
        detail: "✖ console-calls is not a clause of the form <ID>#<clause>\n  → at clauses",
      },
    });
  });

  it("refuses a check that is no check address", () => {
    expect(
      readVersionTwoNames({
        fileText: holding(
          '{ "clauses": { "ACME-1#console-calls": { "check": "console", "title": "Console calls" } }, "symptoms": {}, "cases": {}, "principles": {}, "rules": {} }',
        ),
        path: PATH,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: PATH,
        detail:
          '✖ console is not a check address <symptom>#<check>\n  → at clauses["ACME-1#console-calls"].check',
      },
    });
  });

  it("refuses a names file that leaves out a listing", () => {
    expect(
      readVersionTwoNames({
        fileText: holding('{ "clauses": {}, "symptoms": {}, "cases": {}, "principles": {} }'),
        path: PATH,
      }),
    ).toMatchObject({ outcome: "failed", error: { kind: "file-malformed", path: PATH } });
  });

  it("refuses a names file that is not JSON", () => {
    expect(readVersionTwoNames({ fileText: holding("{"), path: PATH })).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: PATH },
    });
  });
});
