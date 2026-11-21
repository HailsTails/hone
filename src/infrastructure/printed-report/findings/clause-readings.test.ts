import { describe, expect, it, vi } from "vitest";
import type { Finding } from "../../../domain/finding/governance.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import { createPathPort } from "../../node/path-port.ts";
import { absolutePathSchema } from "../../content-files/absolute-path.ts";
import { clauseAddressSchema } from "../../discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../hone-records-folder/repo-path.ts";
import type { Result } from "../../../domain/result.ts";
import { clauseReadingsOf } from "./clause-readings.ts";

type FakeFile = {
  readonly read: Result<string, { readonly kind: "unreadable"; readonly path: string; readonly detail: string }>;
  readonly presence: "present" | "absent";
};

const presentFile = (request: { readonly text: string }): FakeFile => ({
  read: { outcome: "ok", value: request.text },
  presence: "present",
});

const ABSENT_FILE: FakeFile = {
  read: { outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } },
  presence: "absent",
};

const UNREADABLE_FILE: FakeFile = {
  read: { outcome: "failed", error: { kind: "unreadable", path: "/repo/disciplines.assessment.md", detail: "EACCES" } },
  presence: "present",
};

const fileOf = (request: { readonly files: Readonly<Record<string, FakeFile>>; readonly path: string }): FakeFile =>
  request.files[request.path] ?? ABSENT_FILE;

const filesOver = (files: Readonly<Record<string, FakeFile>>): FileTextPort => ({
  read: ({ path }) => fileOf({ files, path }).read,
  exists: ({ path }) => fileOf({ files, path }).presence,
  write: vi.fn<FileTextPort["write"]>(),
});

const REPO_ROOT = absolutePathSchema.parse("/repo");

const ASSESSMENT_PATH = "/repo/disciplines.assessment.md";

const LOOPS = clauseAddressSchema.parse("CD-15#loops");

const CLASS_SYNTAX = clauseAddressSchema.parse("CD-14#class-syntax");

const TEAM_CLAUSE = clauseAddressSchema.parse("team/TM-1#no-tmp-files");

const LOOPS_PAGE = "/repo/node_modules/@hailstails/hone/rules/CD-15/README.md";

const CLASS_SYNTAX_PAGE = "/repo/node_modules/@hailstails/hone/rules/CD-14/README.md";

const SHIPPED_ROOT = absolutePathSchema.parse("/repo/node_modules/@hailstails/hone");

const CLAUSE_ROOTS = [
  { clause: LOOPS, ruleSetRoot: SHIPPED_ROOT },
  { clause: CLASS_SYNTAX, ruleSetRoot: SHIPPED_ROOT },
  { clause: TEAM_CLAUSE, ruleSetRoot: absolutePathSchema.parse("/repo/team-rules") },
];

const findingOn = (request: { readonly clause: Finding["clause"]; readonly file: string }): Finding => ({
  clause: request.clause,
  mechanism: mechanismIdSchema.parse("audit"),
  file: repoPathSchema.parse(request.file),
  anchor: { line: 1, column: 0 },
  snippet: "const total = 0;",
});

const SHIPPED_PAGES: Readonly<Record<string, FakeFile>> = {
  [LOOPS_PAGE]: presentFile({ text: "# CD-15\n" }),
  [CLASS_SYNTAX_PAGE]: presentFile({ text: "# CD-14\n" }),
};

const INSTALL_ROOT = absolutePathSchema.parse("/repo/node_modules/@hailstails/hone");

const readingsOver = (request: { readonly files: FileTextPort; readonly findings: readonly Finding[] }) =>
  clauseReadingsOf({
    findings: request.findings,
    clauseRoots: CLAUSE_ROOTS,
    repoRoot: REPO_ROOT,
    installRoot: INSTALL_ROOT,
    fileText: request.files,
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
  });

const LOOPS_PAGE_TEXT = "node_modules/@hailstails/hone/rules/CD-15/README.md";

const GUIDE_TEXT = "node_modules/@hailstails/hone/ADOPTING.md";

const loopsReading = (request: { readonly assessmentSection: "present" | "not-assessed" | "unread" }) => ({
  kind: "clause",
  clause: LOOPS,
  assessmentSection: request.assessmentSection,
  rulePage: { path: LOOPS_PAGE_TEXT, presence: "present" },
});

const ONE_LOOPS_FINDING = [findingOn({ clause: LOOPS, file: "src/a.ts" })];

describe("clauseReadingsOf", () => {
  it("reads nothing and points nowhere when there are no findings", () => {
    const files = filesOver(SHIPPED_PAGES);
    const reads = vi.spyOn(files, "read");
    const checks = vi.spyOn(files, "exists");

    expect({ readings: readingsOver({ files, findings: [] }), reads: reads.mock.calls, checks: checks.mock.calls }).toEqual({
      readings: [],
      reads: [],
      checks: [],
    });
  });

  it("points once per failing clause, in the order the findings first name them", () => {
    const files = filesOver({ ...SHIPPED_PAGES, [ASSESSMENT_PATH]: presentFile({ text: "# Disciplines assessment\n\n## CD-15#loops\n\n- **Cause here:** x\n" }) });

    expect(
      readingsOver({
        files,
        findings: [
          findingOn({ clause: LOOPS, file: "src/a.ts" }),
          findingOn({ clause: CLASS_SYNTAX, file: "src/a.ts" }),
          findingOn({ clause: LOOPS, file: "src/b.ts" }),
        ],
      }),
    ).toEqual([
      loopsReading({ assessmentSection: "present" }),
      {
        kind: "clause",
        clause: CLASS_SYNTAX,
        assessmentSection: "not-assessed",
        rulePage: { path: "node_modules/@hailstails/hone/rules/CD-14/README.md", presence: "present" },
      },
    ]);
  });

  it("reads the assessment file once however many clauses fail", () => {
    const files = filesOver({ ...SHIPPED_PAGES, [ASSESSMENT_PATH]: presentFile({ text: "## CD-15#loops\n" }) });
    const reads = vi.spyOn(files, "read");
    readingsOver({ files, findings: [findingOn({ clause: LOOPS, file: "src/a.ts" }), findingOn({ clause: CLASS_SYNTAX, file: "src/a.ts" })] });

    expect(reads.mock.calls).toEqual([[{ path: ASSESSMENT_PATH }]]);
  });
});

describe("clauseReadingsOf matching a clause's section", () => {
  it.each([
    { shape: "a heading with trailing spaces and a carriage return", text: "## CD-15#loops  \r\n", expected: "present" },
    { shape: "a heading on the first line after a byte order mark", text: "\uFEFF## CD-15#loops\n", expected: "present" },
    { shape: "a heading after a closed code fence", text: "```md\n## Loops\n```\n\n## CD-15#loops\n", expected: "present" },
    { shape: "the address only inside the section's text", text: "## Loops\n\nCD-15#loops is high-count here.\n", expected: "not-assessed" },
    { shape: "a level-3 heading", text: "### CD-15#loops\n", expected: "not-assessed" },
    { shape: "a heading with more than the address", text: "## CD-15#loops in src/\n", expected: "not-assessed" },
    { shape: "a heading with closing hashes", text: "## CD-15#loops ##\n", expected: "not-assessed" },
    { shape: "a heading with two spaces after the hashes", text: "##  CD-15#loops\n", expected: "not-assessed" },
    { shape: "a heading with the rule set named", text: "## hone/CD-15#loops\n", expected: "not-assessed" },
    { shape: "a heading inside a backtick code fence", text: "```md\n## CD-15#loops\n```\n", expected: "not-assessed" },
    { shape: "a heading inside a tilde code fence that holds a backtick line", text: "~~~\n```\n## CD-15#loops\n~~~\n", expected: "not-assessed" },
  ] as const)("finds the section only by a level-2 heading that is exactly the clause address, given $shape", ({ text, expected }) => {
    expect(
      readingsOver({ files: filesOver({ ...SHIPPED_PAGES, [ASSESSMENT_PATH]: presentFile({ text }) }), findings: ONE_LOOPS_FINDING }),
    ).toEqual([loopsReading({ assessmentSection: expected })]);
  });
});

describe("clauseReadingsOf without a readable assessment file", () => {
  it.each([
    { state: "not-written", assessment: ABSENT_FILE },
    { state: "unreadable", assessment: UNREADABLE_FILE },
  ])("notes once that the file is $state, naming the adoption guide, then points each clause at its rule page", ({ state, assessment }) => {
    expect(
      readingsOver({
        files: filesOver({ ...SHIPPED_PAGES, [ASSESSMENT_PATH]: assessment }),
        findings: [findingOn({ clause: LOOPS, file: "src/a.ts" }), findingOn({ clause: CLASS_SYNTAX, file: "src/a.ts" })],
      }),
    ).toEqual([
      { kind: "assessment-file", state, guide: GUIDE_TEXT },
      loopsReading({ assessmentSection: "unread" }),
      {
        kind: "clause",
        clause: CLASS_SYNTAX,
        assessmentSection: "unread",
        rulePage: { path: "node_modules/@hailstails/hone/rules/CD-14/README.md", presence: "present" },
      },
    ]);
  });
});

describe("clauseReadingsOf pointing at the rule page", () => {
  it("names a team rule set's page and says when it has none", () => {
    expect(
      readingsOver({ files: filesOver({ [ASSESSMENT_PATH]: presentFile({ text: "## CD-15#loops\n" }) }), findings: [findingOn({ clause: TEAM_CLAUSE, file: "src/a.ts" })] }),
    ).toEqual([
      { kind: "clause", clause: TEAM_CLAUSE, assessmentSection: "not-assessed", rulePage: { path: "team-rules/rules/TM-1/README.md", presence: "absent" } },
    ]);
  });

  it("names the page and the guide by their absolute paths, with forward slashes, when they are on another root than the repository", () => {
    expect(
      clauseReadingsOf({
        findings: ONE_LOOPS_FINDING,
        clauseRoots: [{ clause: LOOPS, ruleSetRoot: absolutePathSchema.parse("D:\\hone") }],
        repoRoot: absolutePathSchema.parse("C:\\repo"),
        installRoot: absolutePathSchema.parse("D:\\hone"),
        fileText: filesOver({ "D:\\hone\\rules\\CD-15\\README.md": presentFile({ text: "# CD-15\n" }) }),
        path: createPathPort({ flavour: "windows", workingDirectory: () => "C:\\repo" }),
      }),
    ).toEqual([
      { kind: "assessment-file", state: "not-written", guide: "D:/hone/ADOPTING.md" },
      { kind: "clause", clause: LOOPS, assessmentSection: "unread", rulePage: { path: "D:/hone/rules/CD-15/README.md", presence: "present" } },
    ]);
  });
});

describe("clauseReadingsOf when pnpm runs the package from its store", () => {
  const storeRoot = absolutePathSchema.parse("/repo/node_modules/.pnpm/@hailstails+hone@1.0.0/node_modules/@hailstails/hone");
  const manifest = presentFile({ text: '{"name":"@hailstails/hone","version":"1.0.0"}' });
  const storedPages: Readonly<Record<string, FakeFile>> = {
    [`${storeRoot}/rules/CD-15/README.md`]: presentFile({ text: "# CD-15\n" }),
    [`${storeRoot}/package.json`]: manifest,
  };
  const storedReadings = (request: { readonly files: Readonly<Record<string, FakeFile>> }) =>
    clauseReadingsOf({
      findings: ONE_LOOPS_FINDING,
      clauseRoots: [{ clause: LOOPS, ruleSetRoot: storeRoot }],
      repoRoot: REPO_ROOT,
      installRoot: storeRoot,
      fileText: filesOver(request.files),
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
    });

  it("names the page and the guide through the repository's node_modules link when it holds the running package", () => {
    expect(storedReadings({ files: { ...storedPages, "/repo/node_modules/@hailstails/hone/package.json": manifest } })).toEqual([
      { kind: "assessment-file", state: "not-written", guide: GUIDE_TEXT },
      loopsReading({ assessmentSection: "unread" }),
    ]);
  });

  it("names the page and the guide where pnpm put them when the repository has no link to the running package", () => {
    expect(storedReadings({ files: storedPages })).toEqual([
      {
        kind: "assessment-file",
        state: "not-written",
        guide: "node_modules/.pnpm/@hailstails+hone@1.0.0/node_modules/@hailstails/hone/ADOPTING.md",
      },
      {
        kind: "clause",
        clause: LOOPS,
        assessmentSection: "unread",
        rulePage: { path: "node_modules/.pnpm/@hailstails+hone@1.0.0/node_modules/@hailstails/hone/rules/CD-15/README.md", presence: "present" },
      },
    ]);
  });
});
