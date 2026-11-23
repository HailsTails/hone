import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../domain/rule-set/edition-of.ts";
import type { LoadFailureDetail } from "../ports/report/load-failure-detail.ts";
import type { NamedCheckExamplesRepository } from "../ports/rule-set/named-check-examples.ts";
import { checkUnderTestOf } from "./check-conformance.ts";

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
