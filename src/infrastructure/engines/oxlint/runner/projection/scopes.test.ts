import { describe, expect, it, vi } from "vitest";

import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { createProjectionScopes, findUntrackedConfig } from "./scopes.ts";

describe("createProjectionScopes", () => {
  it("assigns each file to its nearest tracked Oxlint config", () => {
    const root = repoPathOf(".oxlintrc.json");
    const parent = repoPathOf("packages/.oxlintrc.jsonc");
    const nested = repoPathOf("packages/app/oxlint.config.ts");
    const main = repoPathOf("main.ts");
    const shared = repoPathOf("packages/shared/index.ts");
    const app = repoPathOf("packages/app/index.ts");

    const scopes = createProjectionScopes({
      trackedPaths: [nested, root, parent, main, shared, app],
      files: [main, shared, app],
    });

    expect(scopes).toEqual([
      { folder: "", config: root, file: "hone.oxlint.json", files: [main] },
      { folder: "packages", config: parent, file: "packages/hone.oxlint.json", files: [shared] },
      {
        folder: "packages/app",
        config: nested,
        file: "packages/app/hone.oxlint.json",
        files: [app],
      },
    ]);
  });
});

describe("findUntrackedConfig", () => {
  it("detects a local package config that would shadow the tracked root", () => {
    const root = repoPathOf(".oxlintrc.json");
    const nested = "app/.oxlintrc.json";
    const files = [repoPathOf("app/index.ts")];
    const exists = vi
      .fn<(file: string) => "present" | "absent">()
      .mockReturnValueOnce("absent")
      .mockReturnValueOnce("absent")
      .mockReturnValueOnce("absent")
      .mockReturnValue("present");

    expect(findUntrackedConfig({ trackedPaths: [root], files, exists })).toBe(nested);
    expect(exists).not.toHaveBeenCalledWith(root);
  });
});
