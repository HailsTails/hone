import { describe, expect, it } from "vitest";
import { packageFileStemOf, TOOL_IDENTITY } from "./tool-identity.ts";

describe("TOOL_IDENTITY", () => {
  it("names the tool Hone, publishes the scoped package @hailstails/hone, which installs the one command hone", () => {
    expect({ name: TOOL_IDENTITY.name, packageName: TOOL_IDENTITY.packageName, command: TOOL_IDENTITY.command }).toEqual({
      name: "Hone",
      packageName: "@hailstails/hone",
      command: "hone",
    });
  });

  it("names the rule set the tool ships hone, a name of its own apart from the command", () => {
    expect(TOOL_IDENTITY.ownRuleSet).toBe("hone");
  });

  it("reserves the ESLint namespace hone-core for its own projection blocks and governance rule, apart from every discipline's hone and hone-cd<N> namespaces", () => {
    expect(TOOL_IDENTITY.reservedEslintNamespace).toBe("hone-core");
  });

  it("names the GitHub repository the package is published from, and the npm name that belongs to an unrelated package", () => {
    expect({ repository: TOOL_IDENTITY.repository, unrelatedNpmPackage: TOOL_IDENTITY.unrelatedNpmPackage }).toEqual({
      repository: "https://github.com/HailsTails/hone",
      unrelatedNpmPackage: "hone",
    });
  });

  it.each([
    ["@hailstails/hone", "hailstails-hone"],
    ["team-hone", "team-hone"],
  ] as const)("files the package %s under the stem %s, the way npm pack names its tarball", (packageName, stem) => {
    expect(packageFileStemOf({ packageName })).toBe(stem);
  });

  it("describes the package in one sentence without narrowing the disciplines to code", () => {
    expect(TOOL_IDENTITY.description).not.toMatch(/coding/);
  });

  it("describes the package in one sentence", () => {
    expect(TOOL_IDENTITY.description).toMatch(/^[^.]+\.$/);
  });
});
