import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { mapRequestToJudgedRequest } from "./judged-request.ts";

describe("mapRequestToJudgedRequest", () => {
  it("leaves the listed outputs out of the files judged and the tracked paths", () => {
    const judged = mapRequestToJudgedRequest({
      engineRequest: {
        files: [repoPathOf("src/source.ts"), repoPathOf("hone.eslint.d.mts")],
        trackedPaths: [
          repoPathOf("src/source.ts"),
          repoPathOf("hone.eslint.mjs"),
          repoPathOf("hone.eslint.d.mts"),
        ],
      },
      outputs: [repoPathOf("hone.eslint.mjs"), repoPathOf("hone.eslint.d.mts")],
    });

    expect(judged).toEqual({
      files: [repoPathOf("src/source.ts")],
      trackedPaths: [repoPathOf("src/source.ts")],
    });
  });

  it("keeps an authored file named as an output elsewhere", () => {
    const judged = mapRequestToJudgedRequest({
      engineRequest: {
        files: [repoPathOf("hone.eslint.d.mts"), repoPathOf("src/hone.eslint.d.mts")],
        trackedPaths: [repoPathOf("hone.eslint.d.mts"), repoPathOf("src/hone.eslint.d.mts")],
      },
      outputs: [repoPathOf("hone.eslint.d.mts")],
    });

    expect(judged).toEqual({
      files: [repoPathOf("src/hone.eslint.d.mts")],
      trackedPaths: [repoPathOf("src/hone.eslint.d.mts")],
    });
  });

  it("gives back the request unchanged when no output is listed", () => {
    const judged = mapRequestToJudgedRequest({
      engineRequest: {
        files: [repoPathOf("src/source.ts")],
        trackedPaths: [repoPathOf("src/source.ts"), repoPathOf("package.json")],
      },
      outputs: [],
    });

    expect(judged).toEqual({
      files: [repoPathOf("src/source.ts")],
      trackedPaths: [repoPathOf("src/source.ts"), repoPathOf("package.json")],
    });
  });
});
