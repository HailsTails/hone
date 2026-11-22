import { describe, expect, it, vi } from "vitest";

import type { PathPort } from "../../application/ports/host/path-port.ts";
import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import { ruleSetNameOf } from "../../domain/rule-set/rule-set-name-of.ts";
import type { DeclaredRuleSet } from "../../domain/settings/settings-file.ts";
import { absolutePathSchema } from "../content-files/absolute-path.ts";
import { ruleSetRootOf } from "./rule-set-root.ts";

const REPO_ROOT = absoluteRootOf("/repo");

const INSTALL_ROOT = absoluteRootOf("/install");

const TEAM = ruleSetNameOf("team");

const GHOST = ruleSetNameOf("ghost");

const IN_FOLDER: readonly DeclaredRuleSet[] = [
  { name: TEAM, location: { location: "folder", path: repoPathOf("rules/team") } },
];

const AT_ROOT: readonly DeclaredRuleSet[] = [{ name: TEAM, location: { location: "repo-root" } }];

const pathResolving = (request: { readonly to: string }): Pick<PathPort, "join" | "resolve"> => ({
  join: vi.fn<PathPort["join"]>().mockReturnValue("/repo/rules/team"),
  resolve: vi
    .fn<PathPort["resolve"]>()
    .mockReturnValue({ outcome: "ok", value: absolutePathSchema.parse(request.to) }),
});

const pathNotResolving: Pick<PathPort, "join" | "resolve"> = {
  join: vi.fn<PathPort["join"]>().mockReturnValue("/repo/rules/team"),
  resolve: vi.fn<PathPort["resolve"]>().mockReturnValue({
    outcome: "failed",
    error: { kind: "working-directory-unusable", path: "/repo/rules/team" },
  }),
};

describe("ruleSetRootOf", () => {
  it("roots the tool's own rule set at the install root", () => {
    expect(
      ruleSetRootOf({
        ruleSet: TOOL_RULE_SET,
        ruleSets: IN_FOLDER,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        path: pathResolving({ to: "/repo/rules/team" }),
      }),
    ).toEqual({
      outcome: "ok",
      value: "/install",
    });
  });

  it("roots a rule set declared at the repository root at the repository root", () => {
    expect(
      ruleSetRootOf({
        ruleSet: { name: TEAM },
        ruleSets: AT_ROOT,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        path: pathResolving({ to: "/repo/rules/team" }),
      }),
    ).toEqual({
      outcome: "ok",
      value: "/repo",
    });
  });

  it("roots a rule set declared in a folder at that folder resolved", () => {
    expect(
      ruleSetRootOf({
        ruleSet: { name: TEAM },
        ruleSets: IN_FOLDER,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        path: pathResolving({ to: "/repo/rules/team" }),
      }),
    ).toEqual({
      outcome: "ok",
      value: "/repo/rules/team",
    });
  });

  it("is unknown-rule-set for a named rule set the settings do not declare", () => {
    expect(
      ruleSetRootOf({
        ruleSet: { name: GHOST },
        ruleSets: IN_FOLDER,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        path: pathResolving({ to: "/repo/rules/team" }),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "unknown-rule-set", name: "ghost" },
    });
  });

  it("is rule-set-invalid at the joined directory when the folder resolves to no absolute path", () => {
    expect(
      ruleSetRootOf({
        ruleSet: { name: TEAM },
        ruleSets: IN_FOLDER,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        path: pathNotResolving,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "rule-set-invalid",
        path: "/repo/rules/team",
        detail: "the directory of rule set team resolves to no absolute path",
      },
    });
  });
});
