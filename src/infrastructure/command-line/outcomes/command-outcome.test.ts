import { describe, expect, it } from "vitest";
import { loadFailureOutcome, projectCommandOutcome, versionCommandOutcome } from "./command-outcome.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";

const WALKER = "walker" as const;

describe("loadFailureOutcome", () => {
  it("exits 2 and prints the load failure line when an input could not be loaded", () => {
    expect(
      loadFailureOutcome({ failure: { kind: "file-malformed", path: "/repo/disciplines.json", detail: "Unexpected end" } }),
    ).toEqual({ code: 2, text: "load failure: file-malformed /repo/disciplines.json Unexpected end\n" });
  });

  it("exits 2 and prints the load failure line when the arguments are invalid", () => {
    expect(loadFailureOutcome({ failure: { kind: "arguments-invalid", detail: "--repo is required" } })).toEqual({
      code: 2,
      text: "load failure: arguments-invalid --repo is required\n",
    });
  });

  it("exits 2 and names the runner failure when a runner failed", () => {
    expect(
      loadFailureOutcome({
        failure: { kind: "runner-failed", mechanism: WALKER, failure: { kind: "runner-invalid-output", detail: "run rejected" } },
      }),
    ).toEqual({ code: 2, text: "load failure: runner-failed audit runner-invalid-output run rejected\n" });
  });
});

describe("projectCommandOutcome", () => {
  it("exits 0 and prints nothing when there are no projection writes", () => {
    expect(projectCommandOutcome({ result: { outcome: "ok", value: [] } })).toEqual({ code: 0, text: "" });
  });

  it("exits 0 and prints one <path> <effect> line per projection write", () => {
    expect(
      projectCommandOutcome({
        result: {
          outcome: "ok",
          value: [
            { path: repoPathOf("eslint.discipline.config.mjs"), effect: "written" },
            { path: repoPathOf("config/eslint.discipline.mjs"), effect: "unchanged" },
          ],
        },
      }),
    ).toEqual({ code: 0, text: "eslint.discipline.config.mjs written\nconfig/eslint.discipline.mjs unchanged\n" });
  });

  it("exits 2 and prints the load failure line on a failure", () => {
    expect(
      projectCommandOutcome({ result: { outcome: "failed", error: { kind: "runner-missing", mechanism: WALKER } } }),
    ).toEqual({ code: 2, text: "load failure: runner-missing audit\n" });
  });
});

describe("versionCommandOutcome", () => {
  it("exits 0 printing the version on its own line", () => {
    expect(versionCommandOutcome({ result: { outcome: "ok", value: "1.0.0" } })).toEqual({ code: 0, text: "1.0.0\n" });
  });

  it("exits 2 printing the load failure line when the version cannot be read", () => {
    expect(
      versionCommandOutcome({ result: { outcome: "failed", error: { kind: "file-unreadable", path: "package.json", detail: "EACCES" } } }),
    ).toEqual({ code: 2, text: "load failure: file-unreadable package.json EACCES\n" });
  });
});
