import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../src/infrastructure/node/file-system/file-system-port.ts";
import type { PathPort } from "../src/infrastructure/node/path-port.ts";
import type { Recipe } from "../src/domain/language-layer/symptom-catalogue.ts";
import type { CommandRunPort, ScratchFilesPort } from "../delivery/install-proof/install-proof-ports.ts";
import { type RecordsRepository, recipeReasonIn, recordsRepositoryIn, type ScratchPorts } from "./hone-records-scratch.ts";

const ROOT = "/tmp/hone-records-1";

const REPOSITORY: RecordsRepository = {
  base: [{ folder: "hone-records/debt", name: "claimed-type.json", records: [{ answers: "claimed-type", file: "src/a.ts" }] }],
  working: [{ folder: "hone-records", name: "dependency-records.json", records: [{ dependency: "zod", nativeWay: "parsing", whyNotEnough: "Repeated." }] }],
};

const portsOf = (request: {
  readonly createTemporaryDirectory: ScratchFilesPort["createTemporaryDirectory"];
  readonly write: FileTextPort["write"];
  readonly run: CommandRunPort["run"];
}): ScratchPorts => ({
  scratch: { createTemporaryDirectory: request.createTemporaryDirectory, makeDirectory: vi.fn<ScratchFilesPort["makeDirectory"]>().mockReturnValue({ outcome: "ok", value: null }) },
  files: { write: request.write },
  commands: { run: request.run },
  path: {
    join: vi
      .fn<PathPort["join"]>()
      .mockReturnValueOnce("/tmp/hone-records-1/hone-records/debt")
      .mockReturnValueOnce("/tmp/hone-records-1/hone-records/debt/claimed-type.json")
      .mockReturnValueOnce("/tmp/hone-records-1/hone-records")
      .mockReturnValueOnce("/tmp/hone-records-1/hone-records/dependency-records.json"),
  },
});

const madeAt = () => vi.fn<ScratchFilesPort["createTemporaryDirectory"]>().mockReturnValue({ outcome: "ok", value: ROOT });

const writing = () => vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined });

const exitingCleanly = () => vi.fn<CommandRunPort["run"]>().mockReturnValue({ outcome: "exited", exitCode: 0, output: "" });

const STUB_WITH_VIFN: Recipe = { name: "stub-with-vifn", title: "Stub with vi.fn", standing: "accepted", reason: { text: "A stub states its answer.", standing: "proposed" } };

describe("recipeReasonIn", () => {
  it("gives the catalogue's own words for a recipe's reason", () => {
    expect(recipeReasonIn({ recipes: [STUB_WITH_VIFN], recipe: "stub-with-vifn" })).toEqual({ outcome: "ok", value: "A stub states its answer." });
  });

  it("fails naming a recipe the catalogue does not hold", () => {
    expect(recipeReasonIn({ recipes: [STUB_WITH_VIFN], recipe: "hand-rolled-fakes" })).toEqual({
      outcome: "failed",
      error: { kind: "scratch-failed", step: "find the recipe hand-rolled-fakes", detail: "the catalogue holds no such recipe" },
    });
  });
});

describe("recordsRepositoryIn", () => {
  it("commits the base records in a fresh repository, then writes the working records over it", () => {
    const write = writing();
    const run = exitingCleanly();
    expect({ made: recordsRepositoryIn({ ports: portsOf({ createTemporaryDirectory: madeAt(), write, run }), repository: REPOSITORY }), writes: write.mock.calls, runs: run.mock.calls }).toEqual({
      made: { outcome: "ok", value: ROOT },
      writes: [
        [{ path: "/tmp/hone-records-1/hone-records/debt/claimed-type.json", text: '{\n  "version": 2,\n  "records": [\n    {\n      "answers": "claimed-type",\n      "file": "src/a.ts"\n    }\n  ]\n}\n' }],
        [
          {
            path: "/tmp/hone-records-1/hone-records/dependency-records.json",
            text: '{\n  "version": 2,\n  "records": [\n    {\n      "dependency": "zod",\n      "nativeWay": "parsing",\n      "whyNotEnough": "Repeated."\n    }\n  ]\n}\n',
          },
        ],
      ],
      runs: [
        [{ command: "git", arguments: ["init", "-q"], directory: ROOT }],
        [{ command: "git", arguments: ["add", "-A"], directory: ROOT }],
        [{ command: "git", arguments: ["-c", "user.name=hone-records", "-c", "user.email=hone-records@invalid", "-c", "commit.gpgsign=false", "commit", "-q", "-m", "base"], directory: ROOT }],
      ],
    });
  });

  it("fails naming the git step that did not exit cleanly, with git's output", () => {
    expect(
      recordsRepositoryIn({
        ports: portsOf({
          createTemporaryDirectory: madeAt(),
          write: writing(),
          run: vi
            .fn<CommandRunPort["run"]>()
            .mockReturnValueOnce({ outcome: "exited", exitCode: 0, output: "" })
            .mockReturnValueOnce({ outcome: "exited", exitCode: 128, output: "fatal: not a git repository" }),
        }),
        repository: REPOSITORY,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "scratch-failed", step: "git add -A", detail: "fatal: not a git repository" } });
  });

  it("fails when git cannot be started", () => {
    expect(
      recordsRepositoryIn({
        ports: portsOf({ createTemporaryDirectory: madeAt(), write: writing(), run: vi.fn<CommandRunPort["run"]>().mockReturnValue({ outcome: "not-exited", detail: "spawn git ENOENT" }) }),
        repository: REPOSITORY,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "scratch-failed", step: "git init -q", detail: "spawn git ENOENT" } });
  });

  it("fails when the temporary directory cannot be made", () => {
    expect(
      recordsRepositoryIn({
        ports: portsOf({
          createTemporaryDirectory: vi.fn<ScratchFilesPort["createTemporaryDirectory"]>().mockReturnValue({ outcome: "failed", error: { kind: "effect-failed", detail: "EACCES" } }),
          write: writing(),
          run: exitingCleanly(),
        }),
        repository: REPOSITORY,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "scratch-failed", step: "make the temporary directory", detail: "EACCES" } });
  });

  it("fails when a records file cannot be written", () => {
    expect(
      recordsRepositoryIn({
        ports: portsOf({
          createTemporaryDirectory: madeAt(),
          write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "failed", error: { kind: "unwritable", path: "/tmp/hone-records-1/hone-records/debt/claimed-type.json", detail: "EROFS" } }),
          run: exitingCleanly(),
        }),
        repository: REPOSITORY,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "scratch-failed", step: "write /tmp/hone-records-1/hone-records/debt/claimed-type.json", detail: "EROFS" } });
  });
});
