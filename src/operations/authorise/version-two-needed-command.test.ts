import { describe, expect, it } from "vitest";
import { commandOver, memoryRepositoryOf, recordedProcessWith } from "../../../tests/command-harness.ts";
import { versionTwoNeededCommandOf } from "./version-two-needed-command.ts";

const ranOver = async (request: { readonly files: Readonly<Record<string, string>>; readonly arguments: readonly string[] }) => {
  const recorded = recordedProcessWith({ arguments: request.arguments });
  await versionTwoNeededCommandOf(commandOver({ process: recorded.port, fileText: memoryRepositoryOf({ files: request.files }).fileText }));
  return { writes: recorded.writes, exits: recorded.exits };
};

describe("versionTwoNeededCommandOf", () => {
  it("names the version 1 file that needs upgrading when the folder holds disciplines.json", async () => {
    expect(await ranOver({ files: { "disciplines.json": "{}" }, arguments: ["--repo", "/repo"] })).toEqual({
      writes: [[{ text: "load failure: upgrade-needed disciplines.json: this is a version 1 file; run node /install/src/hone.ts upgrade --repo /repo, which rewrites every version 1 file as version 2, and commit what it writes\n" }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("says the folder holds no hone.config.json when it holds no version 1 file either", async () => {
    expect(await ranOver({ files: {}, arguments: ["--repo", "/repo"] })).toEqual({
      writes: [[{ text: "load failure: config-absent /repo holds no hone.config.json; give the folder that holds it, usually the repository root\n" }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("says --repo is needed, without looking at any file, when it is not given", async () => {
    expect(await ranOver({ files: { "disciplines.json": "{}" }, arguments: [] })).toEqual({
      writes: [[{ text: "load failure: arguments-invalid hone authorise needs --repo <dir>: the folder that holds hone.config.json, usually the repository root\n" }]],
      exits: [[{ code: 2 }]],
    });
  });
});
