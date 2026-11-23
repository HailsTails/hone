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
import { checkConformanceOf, checkUnderTestOf } from "./check-conformance.ts";

describe("checkUnderTestOf", () => {
  it("rejects an invalid address before opening a declaration", () => {
    const examples: NamedCheckExamplesRepository = {
      read: vi.fn<NamedCheckExamplesRepository["read"]>(),
    };
    expect(
      checkUnderTestOf({
        check: "../example#sample",
        engine: "walker",
        installRoot: absoluteRootOf("/install"),
        examples,
        loadFailureDetail: vi.fn<LoadFailureDetail>(),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "address-invalid", detail: "../example#sample" },
    });
    expect(examples.read).not.toHaveBeenCalled();
  });

  it("reports an absent named check separately from a malformed address", () => {
    const examples: NamedCheckExamplesRepository = {
      read: vi.fn<NamedCheckExamplesRepository["read"]>().mockReturnValueOnce({
        outcome: "failed",
        error: { kind: "piece-missing", address: "example#absent", mechanism: "walker" },
      }),
    };
    const loadFailureDetail = vi
      .fn<LoadFailureDetail>()
      .mockReturnValueOnce("example#absent has no walker piece");
    expect(
      checkUnderTestOf({
        check: "example#absent",
        engine: "walker",
        installRoot: absoluteRootOf("/install"),
        examples,
        loadFailureDetail,
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "check-missing", detail: "example#absent has no walker piece" },
    });
  });

  it("uses the piece's default edition and preserves an explicit example edition", () => {
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
              declared: [editionOf("1"), editionOf("2")],
              default: editionOf("1"),
              latest: editionOf("2"),
            },
          },
          examples: [
            {
              name: "first edition",
              fileName: repoPathOf("src/first.ts"),
              source: "const first = 1;",
              expectedLines: [],
            },
            {
              name: "second edition",
              fileName: repoPathOf("src/second.ts"),
              source: "const second = 2;",
              expectedLines: [1],
              edition: editionOf("2"),
            },
          ],
        },
      }),
    };
    expect(
      checkUnderTestOf({
        check: "example#sample",
        engine: "walker",
        installRoot: absoluteRootOf("/install"),
        examples,
        loadFailureDetail: vi.fn<LoadFailureDetail>(),
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        check: "example#sample",
        engine: "walker",
        examples: [
          { name: "first edition", file: "src/first.ts", source: "const first = 1;", edition: "1" },
          {
            name: "second edition",
            file: "src/second.ts",
            source: "const second = 2;",
            edition: "2",
          },
        ],
      },
    });
  });
});

const EDITION_ONE_PIECE: NamedCheckExamples["piece"] = {
  anchor: { kind: "file" },
  pieceRoot: "/install/piece",
  exceptions: "allowed",
  settings: {},
  forms: {},
  declarations: {},
  editions: { declared: [editionOf("1")], default: editionOf("1"), latest: editionOf("1") },
};

const FIRST_EXAMPLE = {
  name: "first edition",
  fileName: repoPathOf("src/first.ts"),
  source: "const first = 1;",
  expectedLines: [],
};

describe("checkConformanceOf", () => {
  it("runs an installed check's examples as a binding of Hone's own rule set", async () => {
    const runner = { conform: vi.fn() };
    const enginePort: NamedConformancePort = {
      load: vi
        .fn<NamedConformancePort["load"]>()
        .mockResolvedValue({ outcome: "ok", value: runner }),
      conform: vi
        .fn<NamedConformancePort["conform"]>()
        .mockResolvedValue({ outcome: "ok", value: [] }),
    };
    const examples: NamedCheckExamplesRepository = {
      read: vi.fn<NamedCheckExamplesRepository["read"]>().mockReturnValueOnce({
        outcome: "ok",
        value: {
          piece: EDITION_ONE_PIECE,
          examples: [FIRST_EXAMPLE],
        },
      }),
    };
    await checkConformanceOf({
      check: "example#sample",
      engine: "walker",
      installRoot: absoluteRootOf("/install"),
      moduleExtension: ".ts",
      modules: { load: vi.fn() },
      path: { join: vi.fn() },
      examples,
      enginePort,
      loadFailureDetail: vi.fn<LoadFailureDetail>(),
    });
    expect(enginePort.conform).toHaveBeenCalledExactlyOnceWith({
      binding: {
        address: "example#sample",
        ruleSet: "hone",
        engine: "walker",
        anchor: { kind: "file" },
        pieceRoot: "/install/piece",
        settings: {},
        forms: {},
        checkSettings: {},
        edition: "1",
      },
      cases: [FIRST_EXAMPLE],
      runner,
    });
  });
});
