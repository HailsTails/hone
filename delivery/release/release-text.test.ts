import { describe, expect, it, vi } from "vitest";
import type { ProcessPort } from "../../src/infrastructure/node/process/process-port.ts";
import { distTagOf, releaseTextOf, runReleaseText } from "./release-text.ts";

const IDENTITY = {
  name: "Tool",
  packageName: "tooled",
  command: "tool",
  ownRuleSet: "tool",
  reservedEslintNamespace: "tooled",
  description: "Checks.",
  repository: "https://github.com/example/tool",
  unrelatedNpmPackage: "tool",
};

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const outputOf = (request: { readonly process: ProcessPort }) => ({
  writes: vi.mocked(request.process.writeOut).mock.calls,
  errors: vi.mocked(request.process.writeError).mock.calls,
  exits: vi.mocked(request.process.exitWith).mock.calls,
});

describe("releaseTextOf", () => {
  it("titles the release with the tool's name and the tag", () => {
    expect(releaseTextOf({ identity: IDENTITY, tag: "v0.1.0-pre.1", part: "title" })).toBe("Tool v0.1.0-pre.1");
  });

  it("notes, without naming the version, how to install a pre-release from npm or the attached tarball and the command it provides", () => {
    expect(releaseTextOf({ identity: IDENTITY, tag: "v0.1.0-pre.1", part: "notes" })).toBe(
      "Install it with `npm install --save-dev tooled@next` once it is approved on npm, or install the attached tarball. The package is tooled, not the unscoped tool, which is an unrelated npm package; it provides the command tool.",
    );
  });

  it("notes a stable release's install under the latest dist-tag", () => {
    expect(releaseTextOf({ identity: IDENTITY, tag: "v1.0.0", part: "notes" })).toBe(
      "Install it with `npm install --save-dev tooled@latest` once it is approved on npm, or install the attached tarball. The package is tooled, not the unscoped tool, which is an unrelated npm package; it provides the command tool.",
    );
  });
});

describe("distTagOf", () => {
  it.each([
    ["v0.1.0-pre.1", "next"],
    ["v1.0.0-rc.1+build.5", "next"],
    ["v1.0.0", "latest"],
    ["v1.0.0+build-1", "latest"],
    ["v1.0.0+build.1-a", "latest"],
  ] as const)("publishes %s under %s, reading a pre-release only from the part before build metadata", (tag, distTag) => {
    expect(distTagOf({ tag })).toBe(distTag);
  });

  it("is the release text part dist-tag", () => {
    expect(releaseTextOf({ identity: IDENTITY, tag: "v1.0.0+build-1", part: "dist-tag" })).toBe("latest");
  });
});

describe("runReleaseText", () => {
  it("prints the requested part for the tag on standard output and exits 0", () => {
    const processPort = processWith({ arguments: ["title", "v0.1.0-pre.1"] });

    runReleaseText({ process: processPort, identity: IDENTITY });

    expect(outputOf({ process: processPort })).toEqual({ writes: [[{ text: "Tool v0.1.0-pre.1" }]], errors: [], exits: [[{ code: 0 }]] });
  });

  it("exits 2 with its usage on standard error when the part is unknown", () => {
    const processPort = processWith({ arguments: ["body", "v0.1.0-pre.1"] });

    runReleaseText({ process: processPort, identity: IDENTITY });

    expect(outputOf({ process: processPort })).toEqual({
      writes: [],
      errors: [[{ text: "usage: release-text <title|notes|dist-tag> <tag>\n" }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 2 with its usage on standard error when the tag is missing", () => {
    const processPort = processWith({ arguments: ["notes"] });

    runReleaseText({ process: processPort, identity: IDENTITY });

    expect(outputOf({ process: processPort })).toEqual({
      writes: [],
      errors: [[{ text: "usage: release-text <title|notes|dist-tag> <tag>\n" }]],
      exits: [[{ code: 2 }]],
    });
  });
});
