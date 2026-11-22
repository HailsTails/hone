import { describe, expect, it } from "vitest";
import { createPathPort } from "../../node/path-port.ts";
import { UNLINKED } from "./package-link.ts";
import { shownFailureOf, shownPathOf } from "./shown-path.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";

const WINDOWS = createPathPort({ flavour: "windows", workingDirectory: () => "C:\\work" });

const REPO_ROOT = absoluteRootOf("C:\\work\\my repo");

const STORE_ROOT = absoluteRootOf("C:\\work\\my repo\\node_modules\\.pnpm\\@hailstails+hone@1.0.0\\node_modules\\@hailstails\\hone");

const LINKED = { kind: "linked", installRoot: STORE_ROOT, linkRoot: "C:\\work\\my repo\\node_modules\\@hailstails\\hone" } as const;

describe("shownPathOf", () => {
  it.each([
    { target: "C:\\work\\my repo\\disciplines.json", shown: "disciplines.json" },
    {
      target: "C:\\work\\my repo\\node_modules\\@hailstails\\hone\\rules\\CD-15\\README.md",
      shown: "node_modules/@hailstails/hone/rules/CD-15/README.md",
    },
    { target: "C:\\work\\shared\\rules\\TM-1\\discipline.json", shown: "../shared/rules/TM-1/discipline.json" },
    { target: "D:\\hone\\package.json", shown: "D:/hone/package.json" },
  ])("shows $target as $shown", ({ target, shown }) => {
    expect(shownPathOf({ path: WINDOWS, repoRoot: REPO_ROOT, link: UNLINKED, target })).toBe(shown);
  });

  it.each([
    {
      target: `${STORE_ROOT}\\rules\\CD-15\\README.md`,
      shown: "node_modules/@hailstails/hone/rules/CD-15/README.md",
    },
    { target: `${STORE_ROOT}\\ADOPTING.md`, shown: "node_modules/@hailstails/hone/ADOPTING.md" },
    { target: STORE_ROOT, shown: "node_modules/@hailstails/hone" },
    {
      target: "C:\\work\\my repo\\node_modules\\.pnpm\\eslint@10.0.0\\node_modules\\eslint",
      shown: "node_modules/.pnpm/eslint@10.0.0/node_modules/eslint",
    },
    { target: "C:\\work\\my repo\\disciplines.json", shown: "disciplines.json" },
  ])("shows $target through the repository's link to the running package as $shown", ({ target, shown }) => {
    expect(shownPathOf({ path: WINDOWS, repoRoot: REPO_ROOT, link: LINKED, target })).toBe(shown);
  });

  it("shows a path into the running package where pnpm put it when the repository has no link to it", () => {
    expect(shownPathOf({ path: WINDOWS, repoRoot: REPO_ROOT, link: UNLINKED, target: `${STORE_ROOT}\\ADOPTING.md` })).toBe(
      "node_modules/.pnpm/@hailstails+hone@1.0.0/node_modules/@hailstails/hone/ADOPTING.md",
    );
  });

  it("shows a path with forward slashes when there is no repository folder yet", () => {
    expect(shownPathOf({ path: WINDOWS, repoRoot: undefined, link: UNLINKED, target: "C:\\hone\\package.json" })).toBe("C:/hone/package.json");
  });
});

describe("shownFailureOf", () => {
  it.each([
    {
      failure: { kind: "file-malformed", path: "C:\\work\\my repo\\disciplines.json", detail: "x" },
      shown: { kind: "file-malformed", path: "disciplines.json", detail: "x" },
    },
    {
      failure: { kind: "unsupported-version", path: "C:\\work\\my repo\\discipline-exceptions.json", found: 2 },
      shown: { kind: "unsupported-version", path: "discipline-exceptions.json", found: 2 },
    },
    {
      failure: { kind: "rule-set-invalid", path: "C:\\work\\my repo\\team\\rules\\TM-1\\discipline.json", detail: "x" },
      shown: { kind: "rule-set-invalid", path: "team/rules/TM-1/discipline.json", detail: "x" },
    },
    { failure: { kind: "git-failed", detail: "C:\\work" }, shown: { kind: "git-failed", detail: "C:\\work" } },
  ] as const)("shows the paths of a $failure.kind failure as the report shows paths", ({ failure, shown }) => {
    expect(shownFailureOf({ failure, path: WINDOWS, repoRoot: REPO_ROOT, link: UNLINKED })).toEqual(shown);
  });

  it("shows the paths a runner failure names", () => {
    expect(
      shownFailureOf({
        failure: {
          kind: "runner-failed",
          mechanism: "eslint",
          failure: {
            kind: "toolchain-shadowed",
            packageName: "eslint",
            location: "C:\\work\\my repo\\node_modules\\@hailstails\\hone\\node_modules\\eslint",
            installRoot: "C:\\work\\my repo\\node_modules\\@hailstails\\hone",
          },
        },
        path: WINDOWS,
        repoRoot: REPO_ROOT,
        link: UNLINKED,
      }),
    ).toMatchObject({
      failure: { location: "node_modules/@hailstails/hone/node_modules/eslint", installRoot: "node_modules/@hailstails/hone" },
    });
  });

  it("shows a piece folder inside the running package through the repository's link", () => {
    expect(
      shownFailureOf({
        failure: {
          kind: "runner-failed",
          mechanism: "audit",
          failure: { kind: "piece-invalid", pieceRoot: `${STORE_ROOT}\\mechanisms\\audit\\CD-15`, detail: "x" },
        },
        path: WINDOWS,
        repoRoot: REPO_ROOT,
        link: LINKED,
      }),
    ).toMatchObject({ failure: { pieceRoot: "node_modules/@hailstails/hone/mechanisms/audit/CD-15" } });
  });

  it("leaves a runner failure's repository path as it is", () => {
    const failure = {
      kind: "runner-failed",
      mechanism: "audit",
      failure: { kind: "file-unreadable", file: repoPathOf("src/a.ts"), detail: "EACCES" },
    } as const;

    expect(shownFailureOf({ failure, path: WINDOWS, repoRoot: REPO_ROOT, link: UNLINKED })).toEqual(failure);
  });
});
