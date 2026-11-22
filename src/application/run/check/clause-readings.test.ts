import { describe, expect, it, vi } from "vitest";
import type { Finding } from "../../../domain/finding/governance.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { ShownPathOf } from "../../ports/installation/shown-path-of.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import { clauseReadingsOf } from "./clause-readings.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { ruleSetNameOf } from "../../../domain/rule-set/rule-set-name-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";

type ReadableFiles = Pick<FileTextPort, "read" | "exists">;

const pathJoining = (join: PathPort["join"]): PathPort => ({
  join,
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  relative: vi.fn<PathPort["relative"]>(),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
});

const shownAs = (shown: string): ShownPathOf => vi.fn<ShownPathOf>().mockReturnValue(shown);

const assessmentHolding = (request: { readonly text: string }): ReadableFiles => ({
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: request.text }),
});

const assessmentNotWritten = (): ReadableFiles => ({
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("absent").mockReturnValue("present"),
  read: vi.fn<FileTextPort["read"]>(),
});

const assessmentUnreadable = (): ReadableFiles => ({
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: "/repo/disciplines.assessment.md", detail: "EACCES" } }),
});

const REPO_ROOT = absoluteRootOf("/repo");

const ASSESSMENT_PATH = "/repo/disciplines.assessment.md";

const LOOPS = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-15"), clause: clauseIdOf("loops") };

const CLASS_SYNTAX = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-14"), clause: clauseIdOf("class-syntax") };

const TEAM_CLAUSE = { ruleSet: { name: ruleSetNameOf("team") }, discipline: disciplineIdOf("TM-1"), clause: clauseIdOf("no-tmp-files") };

const LOOPS_PAGE = "/repo/node_modules/@hailstails/hone/rules/CD-15/README.md";

const CLASS_SYNTAX_PAGE = "/repo/node_modules/@hailstails/hone/rules/CD-14/README.md";

const TEAM_PAGE = "/repo/team-rules/rules/TM-1/README.md";

const GUIDE_PAGE = "/repo/node_modules/@hailstails/hone/ADOPTING.md";

const SHIPPED_ROOT = absoluteRootOf("/repo/node_modules/@hailstails/hone");

const CLAUSE_ROOTS = [
  { clause: LOOPS, ruleSetRoot: SHIPPED_ROOT, checks: [] },
  { clause: CLASS_SYNTAX, ruleSetRoot: SHIPPED_ROOT, checks: [] },
  { clause: TEAM_CLAUSE, ruleSetRoot: absoluteRootOf("/repo/team-rules"), checks: [] },
];

const findingOn = (request: { readonly clause: Finding["clause"]; readonly file: RepoPath }): Finding => ({
  clause: request.clause,
  mechanism: "audit",
  file: request.file,
  anchor: { line: 1, column: 0 },
  snippet: "const total = 0;",
});

const INSTALL_ROOT = absoluteRootOf("/repo/node_modules/@hailstails/hone");

const LOOPS_PAGE_TEXT = "node_modules/@hailstails/hone/rules/CD-15/README.md";

const CLASS_SYNTAX_PAGE_TEXT = "node_modules/@hailstails/hone/rules/CD-14/README.md";

const GUIDE_TEXT = "node_modules/@hailstails/hone/ADOPTING.md";

const TEAM_PAGE_TEXT = "team-rules/rules/TM-1/README.md";

const readingsOver = (request: {
  readonly fileText: ReadableFiles;
  readonly findings: readonly Finding[];
  readonly join: PathPort["join"];
  readonly shownPathOf: ShownPathOf;
}) =>
  clauseReadingsOf({
    findings: request.findings,
    clauseRoots: CLAUSE_ROOTS,
    repoRoot: REPO_ROOT,
    installRoot: INSTALL_ROOT,
    fileText: request.fileText,
    path: pathJoining(request.join),
    shownPathOf: request.shownPathOf,
  });

const loopsReading = (request: { readonly assessmentSection: "present" | "not-assessed" | "unread" }) => ({
  kind: "clause",
  clause: LOOPS,
  assessmentSection: request.assessmentSection,
  pages: [{ path: LOOPS_PAGE_TEXT, presence: "present", section: "spirit" }],
});

const ONE_LOOPS_FINDING = [findingOn({ clause: LOOPS, file: repoPathOf("src/a.ts") })];

const CLASS_SYNTAX_READING = {
  kind: "clause",
  clause: CLASS_SYNTAX,
  assessmentSection: "unread",
  pages: [{ path: CLASS_SYNTAX_PAGE_TEXT, presence: "present", section: "spirit" }],
};

describe("clauseReadingsOf", () => {
  it("reads nothing and points nowhere when there are no findings", () => {
    const fileText = assessmentHolding({ text: "" });
    expect({
      readings: readingsOver({ fileText, findings: [], join: vi.fn<PathPort["join"]>(), shownPathOf: vi.fn<ShownPathOf>() }),
      reads: vi.mocked(fileText.read).mock.calls,
      checks: vi.mocked(fileText.exists).mock.calls,
    }).toEqual({ readings: [], reads: [], checks: [] });
  });

  it("points once per failing clause, in the order the findings first name them", () => {
    const fileText = assessmentHolding({ text: "# Disciplines assessment\n\n## CD-15#loops\n\n- **Cause here:** x\n" });

    expect(
      readingsOver({
        fileText,
        findings: [
          findingOn({ clause: LOOPS, file: repoPathOf("src/a.ts") }),
          findingOn({ clause: CLASS_SYNTAX, file: repoPathOf("src/a.ts") }),
          findingOn({ clause: LOOPS, file: repoPathOf("src/b.ts") }),
        ],
        join: vi.fn<PathPort["join"]>().mockReturnValueOnce(ASSESSMENT_PATH).mockReturnValueOnce(LOOPS_PAGE).mockReturnValueOnce(CLASS_SYNTAX_PAGE),
        shownPathOf: vi.fn<ShownPathOf>().mockReturnValueOnce(LOOPS_PAGE_TEXT).mockReturnValueOnce(CLASS_SYNTAX_PAGE_TEXT),
      }),
    ).toEqual([loopsReading({ assessmentSection: "present" }), { ...CLASS_SYNTAX_READING, assessmentSection: "not-assessed" }]);
  });

  it("reads the assessment file once however many clauses fail", () => {
    const fileText = assessmentHolding({ text: "## CD-15#loops\n" });
    readingsOver({
      fileText,
      findings: [findingOn({ clause: LOOPS, file: repoPathOf("src/a.ts") }), findingOn({ clause: CLASS_SYNTAX, file: repoPathOf("src/a.ts") })],
      join: vi.fn<PathPort["join"]>().mockReturnValueOnce(ASSESSMENT_PATH).mockReturnValueOnce(LOOPS_PAGE).mockReturnValueOnce(CLASS_SYNTAX_PAGE),
      shownPathOf: vi.fn<ShownPathOf>().mockReturnValueOnce(LOOPS_PAGE_TEXT).mockReturnValueOnce(CLASS_SYNTAX_PAGE_TEXT),
    });

    expect(vi.mocked(fileText.read).mock.calls).toEqual([[{ path: ASSESSMENT_PATH }]]);
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
      readingsOver({
        fileText: assessmentHolding({ text }),
        findings: ONE_LOOPS_FINDING,
        join: vi.fn<PathPort["join"]>().mockReturnValueOnce(ASSESSMENT_PATH).mockReturnValueOnce(LOOPS_PAGE),
        shownPathOf: shownAs(LOOPS_PAGE_TEXT),
      }),
    ).toEqual([loopsReading({ assessmentSection: expected })]);
  });
});

describe("clauseReadingsOf without a readable assessment file", () => {
  it.each([
    { state: "not-written", fileText: assessmentNotWritten() },
    { state: "unreadable", fileText: assessmentUnreadable() },
  ])("notes once that the file is $state, naming the adoption guide, then points each clause at its rule page", ({ state, fileText }) => {
    expect(
      readingsOver({
        fileText,
        findings: [findingOn({ clause: LOOPS, file: repoPathOf("src/a.ts") }), findingOn({ clause: CLASS_SYNTAX, file: repoPathOf("src/a.ts") })],
        join: vi
          .fn<PathPort["join"]>()
          .mockReturnValueOnce(ASSESSMENT_PATH)
          .mockReturnValueOnce(GUIDE_PAGE)
          .mockReturnValueOnce(LOOPS_PAGE)
          .mockReturnValueOnce(CLASS_SYNTAX_PAGE),
        shownPathOf: vi.fn<ShownPathOf>().mockReturnValueOnce(GUIDE_TEXT).mockReturnValueOnce(LOOPS_PAGE_TEXT).mockReturnValueOnce(CLASS_SYNTAX_PAGE_TEXT),
      }),
    ).toEqual([{ kind: "assessment-file", state, guide: GUIDE_TEXT }, loopsReading({ assessmentSection: "unread" }), CLASS_SYNTAX_READING]);
  });
});

describe("clauseReadingsOf pointing at the rule page", () => {
  it("names a team rule set's page and says when it has none", () => {
    const fileText: ReadableFiles = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present").mockReturnValueOnce("absent"),
      read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: "## CD-15#loops\n" }),
    };
    expect(
      readingsOver({
        fileText,
        findings: [findingOn({ clause: TEAM_CLAUSE, file: repoPathOf("src/a.ts") })],
        join: vi.fn<PathPort["join"]>().mockReturnValueOnce(ASSESSMENT_PATH).mockReturnValueOnce(TEAM_PAGE),
        shownPathOf: shownAs(TEAM_PAGE_TEXT),
      }),
    ).toEqual([{ kind: "clause", clause: TEAM_CLAUSE, assessmentSection: "not-assessed", pages: [{ path: TEAM_PAGE_TEXT, presence: "absent", section: "spirit" }] }]);
  });

  it("names the page and the guide as the shown path gives them when they are on another root than the repository", () => {
    expect(
      clauseReadingsOf({
        findings: ONE_LOOPS_FINDING,
        clauseRoots: [{ clause: LOOPS, ruleSetRoot: absoluteRootOf("D:\\hone"), checks: [] }],
        repoRoot: absoluteRootOf("C:\\repo"),
        installRoot: absoluteRootOf("D:\\hone"),
        fileText: assessmentNotWritten(),
        path: pathJoining(
          vi
            .fn<PathPort["join"]>()
            .mockReturnValueOnce("C:\\repo\\disciplines.assessment.md")
            .mockReturnValueOnce("D:\\hone\\ADOPTING.md")
            .mockReturnValueOnce("D:\\hone\\rules\\CD-15\\README.md"),
        ),
        shownPathOf: vi.fn<ShownPathOf>().mockReturnValueOnce("D:/hone/ADOPTING.md").mockReturnValueOnce("D:/hone/rules/CD-15/README.md"),
      }),
    ).toEqual([
      { kind: "assessment-file", state: "not-written", guide: "D:/hone/ADOPTING.md" },
      { kind: "clause", clause: LOOPS, assessmentSection: "unread", pages: [{ path: "D:/hone/rules/CD-15/README.md", presence: "present", section: "spirit" }] },
    ]);
  });
});

describe("clauseReadingsOf when pnpm runs the package from its store", () => {
  const storeRoot = absoluteRootOf("/repo/node_modules/.pnpm/@hailstails+hone@1.0.0/node_modules/@hailstails/hone");
  const storedReadings = (request: { readonly shownPathOf: ShownPathOf }) =>
    clauseReadingsOf({
      findings: ONE_LOOPS_FINDING,
      clauseRoots: [{ clause: LOOPS, ruleSetRoot: storeRoot, checks: [] }],
      repoRoot: REPO_ROOT,
      installRoot: storeRoot,
      fileText: assessmentNotWritten(),
      path: pathJoining(
        vi
          .fn<PathPort["join"]>()
          .mockReturnValueOnce(ASSESSMENT_PATH)
          .mockReturnValueOnce("/repo/node_modules/.pnpm/@hailstails+hone@1.0.0/node_modules/@hailstails/hone/ADOPTING.md")
          .mockReturnValueOnce("/repo/node_modules/.pnpm/@hailstails+hone@1.0.0/node_modules/@hailstails/hone/rules/CD-15/README.md"),
      ),
      shownPathOf: request.shownPathOf,
    });

  it("names the page and the guide through the repository's node_modules link when it holds the running package", () => {
    expect(storedReadings({ shownPathOf: vi.fn<ShownPathOf>().mockReturnValueOnce(GUIDE_TEXT).mockReturnValueOnce(LOOPS_PAGE_TEXT) })).toEqual([
      { kind: "assessment-file", state: "not-written", guide: GUIDE_TEXT },
      loopsReading({ assessmentSection: "unread" }),
    ]);
  });

  it("names the page and the guide where pnpm put them when the repository has no link to the running package", () => {
    expect(
      storedReadings({
        shownPathOf: vi
          .fn<ShownPathOf>()
          .mockReturnValueOnce("node_modules/.pnpm/@hailstails+hone@1.0.0/node_modules/@hailstails/hone/ADOPTING.md")
          .mockReturnValueOnce("node_modules/.pnpm/@hailstails+hone@1.0.0/node_modules/@hailstails/hone/rules/CD-15/README.md"),
      }),
    ).toEqual([
      {
        kind: "assessment-file",
        state: "not-written",
        guide: "node_modules/.pnpm/@hailstails+hone@1.0.0/node_modules/@hailstails/hone/ADOPTING.md",
      },
      {
        kind: "clause",
        clause: LOOPS,
        assessmentSection: "unread",
        pages: [{ path: "node_modules/.pnpm/@hailstails+hone@1.0.0/node_modules/@hailstails/hone/rules/CD-15/README.md", presence: "present", section: "spirit" }],
      },
    ]);
  });
});

describe("clauseReadingsOf pointing at check items", () => {
  const classKeyword = { name: "class-keyword", symptom: { name: "authored-class-or-this" } };
  const staticMembersOnly = { name: "static-members-only", symptom: { name: "authored-class-or-this" } };
  const classKeywordPage = "/repo/node_modules/@hailstails/hone/rules/typescript/symptoms/authored-class-or-this/class-keyword.md";
  const staticMembersOnlyPage = "/repo/node_modules/@hailstails/hone/rules/typescript/symptoms/authored-class-or-this/static-members-only.md";
  const classKeywordText = "node_modules/@hailstails/hone/rules/typescript/symptoms/authored-class-or-this/class-keyword.md";
  const staticMembersOnlyText = "node_modules/@hailstails/hone/rules/typescript/symptoms/authored-class-or-this/static-members-only.md";
  const checkedRoots = [{ clause: CLASS_SYNTAX, ruleSetRoot: SHIPPED_ROOT, checks: [classKeyword, staticMembersOnly] }];

  it("points a clause whose findings name no check at each of its check items, at the fix where the item has one", () => {
    const join = vi.fn<PathPort["join"]>().mockReturnValueOnce(ASSESSMENT_PATH).mockReturnValueOnce(classKeywordPage).mockReturnValueOnce(staticMembersOnlyPage);
    const fileText: ReadableFiles = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({ outcome: "ok", value: "" })
        .mockReturnValueOnce({ outcome: "ok", value: "# Class keyword\n\n## Fix\n\nWrite a closure factory.\n" })
        .mockReturnValueOnce({ outcome: "ok", value: "# Static members only\n\n## Flags\n" }),
    };
    expect(
      clauseReadingsOf({
        findings: [findingOn({ clause: CLASS_SYNTAX, file: repoPathOf("src/a.ts") })],
        clauseRoots: checkedRoots,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        fileText,
        path: pathJoining(join),
        shownPathOf: vi.fn<ShownPathOf>().mockReturnValueOnce(classKeywordText).mockReturnValueOnce(staticMembersOnlyText),
      }),
    ).toEqual([
      {
        kind: "clause",
        clause: CLASS_SYNTAX,
        assessmentSection: "not-assessed",
        pages: [
          { path: classKeywordText, presence: "present", section: "fix" },
          { path: staticMembersOnlyText, presence: "present", section: "whole-page" },
        ],
      },
    ]);
    expect(join).toHaveBeenNthCalledWith(2, { segments: [SHIPPED_ROOT, "rules", "typescript", "symptoms", "authored-class-or-this", "class-keyword.md"] });
  });

  it("points only at the check items the clause's findings name", () => {
    const fileText: ReadableFiles = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({ outcome: "ok", value: "" })
        .mockReturnValueOnce({ outcome: "ok", value: "## Fix\n" }),
    };
    expect(
      clauseReadingsOf({
        findings: [{ ...findingOn({ clause: CLASS_SYNTAX, file: repoPathOf("src/a.ts") }), check: "authored-class-or-this#static-members-only" }],
        clauseRoots: checkedRoots,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        fileText,
        path: pathJoining(vi.fn<PathPort["join"]>().mockReturnValueOnce(ASSESSMENT_PATH).mockReturnValueOnce(staticMembersOnlyPage)),
        shownPathOf: shownAs(staticMembersOnlyText),
      }),
    ).toEqual([
      { kind: "clause", clause: CLASS_SYNTAX, assessmentSection: "not-assessed", pages: [{ path: staticMembersOnlyText, presence: "present", section: "fix" }] },
    ]);
  });

  it("says when a check item is absent, reading nothing from it", () => {
    const fileText: ReadableFiles = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present").mockReturnValueOnce("absent"),
      read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "ok", value: "" }),
    };
    expect(
      clauseReadingsOf({
        findings: [{ ...findingOn({ clause: CLASS_SYNTAX, file: repoPathOf("src/a.ts") }), check: "authored-class-or-this#class-keyword" }],
        clauseRoots: checkedRoots,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        fileText,
        path: pathJoining(vi.fn<PathPort["join"]>().mockReturnValueOnce(ASSESSMENT_PATH).mockReturnValueOnce(classKeywordPage)),
        shownPathOf: shownAs(classKeywordText),
      }),
    ).toEqual([
      { kind: "clause", clause: CLASS_SYNTAX, assessmentSection: "not-assessed", pages: [{ path: classKeywordText, presence: "absent", section: "whole-page" }] },
    ]);
    expect(fileText.read).toHaveBeenCalledOnce();
  });
});
describe("clauseReadingsOf when the findings name no check the clause carries", () => {
  it("points at every check item of the clause", () => {
    const classKeyword = { name: "class-keyword", symptom: { name: "authored-class-or-this" } };
    const classKeywordText = "node_modules/@hailstails/hone/rules/typescript/symptoms/authored-class-or-this/class-keyword.md";
    const fileText: ReadableFiles = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
      read: vi.fn<FileTextPort["read"]>().mockReturnValueOnce({ outcome: "ok", value: "" }).mockReturnValueOnce({ outcome: "ok", value: "## Fix\n" }),
    };
    expect(
      clauseReadingsOf({
        findings: [{ ...findingOn({ clause: CLASS_SYNTAX, file: repoPathOf("src/a.ts") }), check: "authored-class-or-this#elsewhere" }],
        clauseRoots: [{ clause: CLASS_SYNTAX, ruleSetRoot: SHIPPED_ROOT, checks: [classKeyword] }],
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        fileText,
        path: pathJoining(vi.fn<PathPort["join"]>().mockReturnValueOnce(ASSESSMENT_PATH).mockReturnValueOnce("/repo/class-keyword.md")),
        shownPathOf: shownAs(classKeywordText),
      }),
    ).toEqual([{ kind: "clause", clause: CLASS_SYNTAX, assessmentSection: "not-assessed", pages: [{ path: classKeywordText, presence: "present", section: "fix" }] }]);
  });
});