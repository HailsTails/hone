import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../domain/rule-set/edition-of.ts";
import type { NamedConformancePort } from "../ports/engine/engine-port.ts";
import type { LoadFailureDetail } from "../ports/report/load-failure-detail.ts";
import type {
  NamedCheckExamples,
  NamedCheckExamplesRepository,
} from "../ports/rule-set/named-check-examples.ts";
import { catalogueConformanceOf } from "./catalogue-conformance.ts";

describe("catalogueConformanceOf", () => {
  it("reads examples only for the checks the engine binds", async () => {
    const examples: NamedCheckExamplesRepository = {
      read: vi.fn<NamedCheckExamplesRepository["read"]>().mockReturnValueOnce({
        outcome: "ok",
        value: {
          piece: {
            anchor: { kind: "file" },
            pieceRoot: "/install/piece",
            exceptions: "allowed",
            settings: {},
            forms: {},
            declarations: {},
            editions: {
              declared: [editionOf("1")],
              default: editionOf("1"),
              latest: editionOf("1"),
            },
          },
          examples: [],
        },
      }),
    };
    await catalogueConformanceOf({
      checks: [
        { name: "sample", symptom: { name: "example" }, engines: [{ name: "eslint" }] },
        { name: "walked", symptom: { name: "example" }, engines: [{ name: "walker" }] },
      ],
      ruleSet: "hone",
      engine: "eslint",
      installRoot: absoluteRootOf("/install"),
      moduleExtension: ".ts",
      modules: { load: vi.fn() },
      path: { join: vi.fn(), resolve: vi.fn() },
      examples,
      enginePort: {
        load: vi
          .fn<NamedConformancePort["load"]>()
          .mockResolvedValue({ outcome: "ok", value: { conform: vi.fn() } }),
        conform: vi.fn<NamedConformancePort["conform"]>(),
      },
      loadFailureDetail: vi.fn<LoadFailureDetail>(),
    });
    expect(examples.read).toHaveBeenCalledExactlyOnceWith({
      installRoot: "/install",
      ruleSetRoot: "/install",
      check: "example#sample",
      engine: "eslint",
    });
  });

  it("gathers the conformance failures of every check the engine binds", async () => {
    const piece: NamedCheckExamples["piece"] = {
      anchor: { kind: "file" },
      pieceRoot: "/install/piece",
      exceptions: "allowed",
      settings: {},
      forms: {},
      declarations: {},
      editions: { declared: [editionOf("1")], default: editionOf("1"), latest: editionOf("1") },
    };
    const sourceCase = {
      name: "flagged",
      fileName: repoPathOf("src/flagged.ts"),
      source: "const flagged = 1;",
      expectedLines: [1],
    };
    const examples: NamedCheckExamplesRepository = {
      read: vi
        .fn<NamedCheckExamplesRepository["read"]>()
        .mockReturnValue({ outcome: "ok", value: { piece, examples: [sourceCase] } }),
    };
    const conform = vi
      .fn<NamedConformancePort["conform"]>()
      .mockResolvedValueOnce({ outcome: "ok", value: [] })
      .mockResolvedValueOnce({
        outcome: "ok",
        value: [
          { check: "example#second", caseName: "flagged", expectedLines: [1], flaggedLines: [] },
        ],
      });
    expect(
      await catalogueConformanceOf({
        checks: [
          { name: "first", symptom: { name: "example" }, engines: [{ name: "eslint" }] },
          { name: "second", symptom: { name: "example" }, engines: [{ name: "eslint" }] },
        ],
        ruleSet: "hone",
        engine: "eslint",
        installRoot: absoluteRootOf("/install"),
        moduleExtension: ".ts",
        modules: { load: vi.fn() },
        path: { join: vi.fn(), resolve: vi.fn() },
        examples,
        enginePort: {
          load: vi
            .fn<NamedConformancePort["load"]>()
            .mockResolvedValue({ outcome: "ok", value: { conform: vi.fn() } }),
          conform,
        },
        loadFailureDetail: vi.fn<LoadFailureDetail>(),
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        { check: "example#second", caseName: "flagged", expectedLines: [1], flaggedLines: [] },
      ],
    });
  });

  it("refuses with the first check's setup failure", async () => {
    const examples: NamedCheckExamplesRepository = {
      read: vi.fn<NamedCheckExamplesRepository["read"]>().mockReturnValue({
        outcome: "failed",
        error: { kind: "piece-missing", address: "example#absent", mechanism: "eslint" },
      }),
    };
    expect(
      await catalogueConformanceOf({
        checks: [{ name: "absent", symptom: { name: "example" }, engines: [{ name: "eslint" }] }],
        ruleSet: "hone",
        engine: "eslint",
        installRoot: absoluteRootOf("/install"),
        moduleExtension: ".ts",
        modules: { load: vi.fn() },
        path: { join: vi.fn(), resolve: vi.fn() },
        examples,
        enginePort: {
          load: vi.fn<NamedConformancePort["load"]>(),
          conform: vi.fn<NamedConformancePort["conform"]>(),
        },
        loadFailureDetail: vi
          .fn<LoadFailureDetail>()
          .mockReturnValueOnce("example#absent has no eslint piece"),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "check-missing", detail: "example#absent has no eslint piece" },
    });
  });
});
