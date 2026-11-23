import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { loadFailureDetail, loadFailureText } from "./load-failure-text.ts";

const WALKER = "walker" as const;

const ESLINT = "eslint" as const;

describe("loadFailureText", () => {
  it("prints records-in-both-layouts with the file, the folder and that only one layout is read", () => {
    expect(
      loadFailureText({
        failure: {
          kind: "records-in-both-layouts",
          path: "discipline-exceptions.json",
          folder: "discipline-exceptions",
        },
      }),
    ).toBe(
      "load failure: records-in-both-layouts discipline-exceptions.json discipline-exceptions: Hone reads exception records from one layout; keep each record in one of them and remove the other\n",
    );
  });

  it("prints records-unsplittable with the file and why", () => {
    expect(
      loadFailureText({
        failure: {
          kind: "records-unsplittable",
          path: "discipline-exceptions.json",
          detail: "exceptions[1] names no discipline",
        },
      }),
    ).toBe(
      "load failure: records-unsplittable discipline-exceptions.json exceptions[1] names no discipline\n",
    );
  });

  it("prints an untracked ESLint config root with what the entry must be", () => {
    expect(
      loadFailureText({
        failure: { kind: "config-root-untracked", root: repoPathOf("packages/Web") },
      }),
    ).toBe(
      "load failure: config-root-untracked packages/Web: an eslintConfigRoots entry is a folder git tracks files under outside every excluded path, spelled exactly as git spells it; fix or remove it in disciplines.json\n",
    );
  });
  it("prints one line naming the kind and its detail", () => {
    expect(
      loadFailureText({
        failure: { kind: "git-failed", detail: "git ls-files: not a git repository" },
      }),
    ).toBe("load failure: git-failed git ls-files: not a git repository\n");
  });

  it("prints a file failure's path then its detail", () => {
    expect(
      loadFailureText({
        failure: { kind: "file-unreadable", path: "/repo/disciplines.json", detail: "EACCES" },
      }),
    ).toBe("load failure: file-unreadable /repo/disciplines.json EACCES\n");
  });

  it("prints a duplicate-clause failure's bare then prefixed address", () => {
    expect(
      loadFailureText({
        failure: {
          kind: "duplicate-clause",
          address: "CD-14#class-syntax",
          prefixedAddress: "hone/CD-14#class-syntax",
        },
      }),
    ).toBe("load failure: duplicate-clause CD-14#class-syntax hone/CD-14#class-syntax\n");
  });

  it("prints a rule-set-name-collision failure's two names", () => {
    expect(
      loadFailureText({
        failure: { kind: "rule-set-name-collision", name: "acme", other: "acme-x" },
      }),
    ).toBe("load failure: rule-set-name-collision acme acme-x\n");
  });

  it("prints a mechanism-not-allowed failure's address then its mechanism", () => {
    expect(
      loadFailureText({
        failure: {
          kind: "mechanism-not-allowed",
          address: "CD-14#class-syntax",
          mechanism: WALKER,
        },
      }),
    ).toBe("load failure: mechanism-not-allowed CD-14#class-syntax audit\n");
  });

  it("prints judgement-clause-listed with its address and that judgement clauses are left out of clauses", () => {
    expect(
      loadFailureText({
        failure: { kind: "judgement-clause-listed", address: "CD-14#library-construction" },
      }),
    ).toBe(
      "load failure: judgement-clause-listed CD-14#library-construction: a judgement clause is enforced by review and is left out of clauses, adopted or not; remove it\n",
    );
  });

  it("prints runner-missing with its mechanism", () => {
    expect(loadFailureText({ failure: { kind: "runner-missing", mechanism: WALKER } })).toBe(
      "load failure: runner-missing audit\n",
    );
  });

  it("prints the found version of an unsupported version as JSON", () => {
    expect(
      loadFailureText({
        failure: { kind: "unsupported-version", path: "/repo/disciplines.json", found: "1" },
      }),
    ).toBe('load failure: unsupported-version /repo/disciplines.json "1"\n');
  });

  it("prints runner-failed with its mechanism and the runner failure's kind and fields", () => {
    expect(
      loadFailureText({
        failure: {
          kind: "runner-failed",
          mechanism: WALKER,
          failure: {
            kind: "file-unparseable",
            file: repoPathOf("src/a.ts"),
            detail: "unexpected token",
          },
        },
      }),
    ).toBe("load failure: runner-failed audit file-unparseable src/a.ts unexpected token\n");
  });

  it("prints a missing optional peer with the package, what was found, the supported range and where to install it", () => {
    expect(
      loadFailureText({
        failure: {
          kind: "runner-failed",
          mechanism: WALKER,
          failure: {
            kind: "toolchain-unavailable",
            peers: [
              {
                packageName: "eslint",
                peer: "optional",
                supported: "^9.39.5 || ^10.15.0",
                found: "not installed",
              },
            ],
          },
        },
      }),
    ).toBe(
      "load failure: runner-failed audit toolchain-unavailable eslint found not installed, supported ^9.39.5 || ^10.15.0: add a supported version to the devDependencies of the repository root\n",
    );
  });

  it("prints every unavailable peer on the one line, each with what was found and its range, and asks for a supported version of each", () => {
    expect(
      loadFailureText({
        failure: {
          kind: "runner-failed",
          mechanism: ESLINT,
          failure: {
            kind: "toolchain-unavailable",
            peers: [
              {
                packageName: "@typescript-eslint/parser",
                peer: "optional",
                supported: "^8.73.0",
                found: "not installed",
              },
              {
                packageName: "@typescript-eslint/eslint-plugin",
                peer: "optional",
                supported: "^8.73.0",
                found: "7.18.0",
              },
            ],
          },
        },
      }),
    ).toBe(
      "load failure: runner-failed eslint toolchain-unavailable @typescript-eslint/parser found not installed, supported ^8.73.0; @typescript-eslint/eslint-plugin found 7.18.0, supported ^8.73.0: add a supported version of each to the devDependencies of the repository root\n",
    );
  });

  it("prints toolchain-shadowed with the package, where it resolved, and what to delete before reinstalling core", () => {
    expect(
      loadFailureText({
        failure: {
          kind: "runner-failed",
          mechanism: WALKER,
          failure: {
            kind: "toolchain-shadowed",
            packageName: "eslint",
            location:
              "/repo/node_modules/.pnpm/@hailstails+hone@0.0.0/node_modules/@hailstails/hone/node_modules/eslint/lib/api.js",
            installRoot:
              "/repo/node_modules/.pnpm/@hailstails+hone@0.0.0/node_modules/@hailstails/hone",
          },
        },
      }),
    ).toBe(
      "load failure: runner-failed audit toolchain-shadowed eslint resolved from /repo/node_modules/.pnpm/@hailstails+hone@0.0.0/node_modules/@hailstails/hone/node_modules/eslint/lib/api.js inside the core install /repo/node_modules/.pnpm/@hailstails+hone@0.0.0/node_modules/@hailstails/hone: delete /repo/node_modules/.pnpm/@hailstails+hone@0.0.0/node_modules/@hailstails/hone/node_modules, then reinstall the package with the repository's package manager, so the repository's own copy is used\n",
    );
  });

  it("prints toolchain-shadowed for a packaged install with the same remedy, naming the package folder", () => {
    expect(
      loadFailureText({
        failure: {
          kind: "runner-failed",
          mechanism: WALKER,
          failure: {
            kind: "toolchain-shadowed",
            packageName: "typescript",
            location:
              "/repo/node_modules/@hailstails/hone/node_modules/typescript/lib/typescript.js",
            installRoot: "/repo/node_modules/@hailstails/hone",
          },
        },
      }),
    ).toBe(
      "load failure: runner-failed audit toolchain-shadowed typescript resolved from /repo/node_modules/@hailstails/hone/node_modules/typescript/lib/typescript.js inside the core install /repo/node_modules/@hailstails/hone: delete /repo/node_modules/@hailstails/hone/node_modules, then reinstall the package with the repository's package manager, so the repository's own copy is used\n",
    );
  });

  it("escapes a line feed and a carriage return in a git-failed detail", () => {
    expect(
      loadFailureText({
        failure: { kind: "git-failed", detail: "refused path src/a\nb.ts\rverdict: pass" },
      }),
    ).toBe("load failure: git-failed refused path src/a\\nb.ts\\rverdict: pass\n");
  });

  it("escapes a line feed in a path field", () => {
    expect(
      loadFailureText({
        failure: {
          kind: "file-malformed",
          path: "/repo/a\nverdict: pass",
          detail: "Unexpected end",
        },
      }),
    ).toBe("load failure: file-malformed /repo/a\\nverdict: pass Unexpected end\n");
  });

  it("escapes a line feed in an install root URL", () => {
    expect(
      loadFailureText({
        failure: {
          kind: "install-root-unresolvable",
          url: "https://x/\nverdict: pass",
          detail: "not a file: URL",
        },
      }),
    ).toBe("load failure: install-root-unresolvable https://x/\\nverdict: pass not a file: URL\n");
  });

  it("escapes a line feed in a nested runner failure's detail", () => {
    expect(
      loadFailureText({
        failure: {
          kind: "runner-failed",
          mechanism: WALKER,
          failure: { kind: "tool-failed", detail: "crashed\nverdict: pass" },
        },
      }),
    ).toBe("load failure: runner-failed audit tool-failed crashed\\nverdict: pass\n");
  });
});

describe("loadFailureText for a missing required peer", () => {
  it("prints a missing required peer as an incomplete install of the package, with what was found, the supported range and how to repair it", () => {
    expect(
      loadFailureText({
        failure: {
          kind: "runner-failed",
          mechanism: WALKER,
          failure: {
            kind: "toolchain-unavailable",
            peers: [
              {
                packageName: "typescript",
                peer: "required",
                supported: ">=4.8.4 <7.0.0",
                found: "not installed",
              },
            ],
          },
        },
      }),
    ).toBe(
      "load failure: runner-failed audit toolchain-unavailable typescript found not installed, supported >=4.8.4 <7.0.0: typescript is a required peer of @hailstails/hone, so this install is incomplete; add a supported version to the devDependencies of the repository root and reinstall\n",
    );
  });

  it.each([
    { state: "out of range", found: "7.0.0" },
    { state: "unloadable", found: "unloadable: Cannot find module './lib/typescript.js'" },
  ])(
    "prints a required peer that is installed but $state with the plain repair, not as an incomplete install",
    ({ found }) => {
      expect(
        loadFailureText({
          failure: {
            kind: "runner-failed",
            mechanism: WALKER,
            failure: {
              kind: "toolchain-unavailable",
              peers: [
                { packageName: "typescript", peer: "required", supported: ">=4.8.4 <7.0.0", found },
              ],
            },
          },
        }),
      ).toBe(
        `load failure: runner-failed audit toolchain-unavailable typescript found ${found}, supported >=4.8.4 <7.0.0: add a supported version to the devDependencies of the repository root\n`,
      );
    },
  );
});

describe("loadFailureText for a run that cannot start", () => {
  it("prints selection-absent with the --repo folder as given and where disciplines.json belongs", () => {
    expect(loadFailureText({ failure: { kind: "selection-absent", repo: "src" } })).toBe(
      "load failure: selection-absent src holds no disciplines.json; give the folder that holds it, usually the repository root\n",
    );
  });

  it("prints unexpected-error with what was thrown", () => {
    expect(
      loadFailureText({
        failure: { kind: "unexpected-error", detail: "Cannot read properties of undefined" },
      }),
    ).toBe("load failure: unexpected-error Cannot read properties of undefined\n");
  });
});

describe("loadFailureText, a rule set left in the version 1 layout", () => {
  it("names the rule set's folder", () => {
    expect(
      loadFailureText({ failure: { kind: "rule-set-not-upgraded", path: "/repo/tools/acme" } }),
    ).toBe("load failure: rule-set-not-upgraded /repo/tools/acme\n");
  });
});

describe("loadFailureText, a check two rule sets hold", () => {
  it("names the check and both rule sets", () => {
    expect(
      loadFailureText({
        failure: {
          kind: "rule-sets-share-a-check",
          check: "loop-keyword#loops",
          ruleSets: ["hone", "acme"],
        },
      }),
    ).toBe("load failure: rule-sets-share-a-check loop-keyword#loops hone acme\n");
  });
});

describe("loadFailureText, a rule set an upgrade stopped part way through", () => {
  it("names the rule set's folder and each version 1 file left in it", () => {
    expect(
      loadFailureText({
        failure: {
          kind: "rule-set-half-upgraded",
          path: "/repo/tools/acme",
          files: [
            "/repo/tools/acme/rules/ACME-1/discipline.json",
            "/repo/tools/acme/rules/ACME-2/discipline.json",
          ],
        },
      }),
    ).toBe(
      "load failure: rule-set-half-upgraded /repo/tools/acme /repo/tools/acme/rules/ACME-1/discipline.json /repo/tools/acme/rules/ACME-2/discipline.json\n",
    );
  });
});

describe("loadFailureDetail", () => {
  it("names the kind and its fields on one line, without the load failure prefix", () => {
    expect(
      loadFailureDetail({
        failure: {
          kind: "rule-set-invalid",
          path: "/repo/rules/ACME-2/discipline.json",
          detail: "first\nsecond",
        },
      }),
    ).toBe("rule-set-invalid /repo/rules/ACME-2/discipline.json first\\nsecond");
  });
});
