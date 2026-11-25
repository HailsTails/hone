import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../domain/rule-set/edition-of.ts";
import type { NamedConformancePort } from "../ports/engine/engine-port.ts";
import type { PathPort } from "../ports/host/path-port.ts";
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
        ruleSet: "hone",
        check: "../example#sample",
        engine: "walker",
        installRoot: absoluteRootOf("/install"),
        path: { resolve: vi.fn() },
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
        ruleSet: "hone",
        check: "example#absent",
        engine: "walker",
        installRoot: absoluteRootOf("/install"),
        path: { resolve: vi.fn() },
        examples,
        loadFailureDetail,
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "check-missing", detail: "example#absent has no walker piece" },
    });
  });

  it("returns a check's binding with its examples", () => {
    const firstEdition = editionOf("1");
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
            editions: { declared: [firstEdition], default: firstEdition, latest: firstEdition },
          },
          examples: [
            {
              name: "first edition",
              fileName: repoPathOf("src/first.ts"),
              source: "const first = 1;",
              expectedLines: [],
            },
          ],
        },
      }),
    };

    const request = {
      ruleSet: "hone",
      check: "example#sample",
      engine: "walker",
      installRoot: absoluteRootOf("/install"),
      path: { resolve: vi.fn() },
      examples,
      loadFailureDetail: vi.fn<LoadFailureDetail>(),
    } as const;

    const checked = checkUnderTestOf(request);

    expect(checked).toEqual({
      outcome: "ok",
      value: {
        ruleSet: "hone",
        check: "example#sample",
        engine: "walker",
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
        examples: [
          { name: "first edition", file: "src/first.ts", source: "const first = 1;", edition: "1" },
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

describe("checkUnderTestOf on a team's rule set", () => {
  it("reads the team's examples from its resolved root", () => {
    const examples: NamedCheckExamplesRepository = {
      read: vi.fn<NamedCheckExamplesRepository["read"]>().mockReturnValueOnce({
        outcome: "ok",
        value: { piece: EDITION_ONE_PIECE, examples: [FIRST_EXAMPLE] },
      }),
    };
    const resolve = vi
      .fn<PathPort["resolve"]>()
      .mockReturnValueOnce({ outcome: "ok", value: absoluteRootOf("/repo/tools/acme") });
    checkUnderTestOf({
      ruleSet: { name: "acme", root: "tools/acme" },
      check: "scratch-file#scratch-files",
      engine: "walker",
      installRoot: absoluteRootOf("/install"),
      path: { resolve },
      examples,
      loadFailureDetail: vi.fn<LoadFailureDetail>(),
    });
    expect(resolve).toHaveBeenCalledExactlyOnceWith({ path: "tools/acme" });
    expect(examples.read).toHaveBeenCalledExactlyOnceWith({
      installRoot: "/install",
      ruleSetRoot: "/repo/tools/acme",
      check: "scratch-file#scratch-files",
      engine: "walker",
    });
  });

  it.each([
    {
      name: "hone",
      detail:
        "hone is not a team rule set name: use lower-case letters, digits and hyphens, and not hone",
    },
    {
      name: "Acme",
      detail:
        "Acme is not a team rule set name: use lower-case letters, digits and hyphens, and not hone",
    },
  ])("refuses $name as a team rule set name", ({ name, detail }) => {
    const examples: NamedCheckExamplesRepository = {
      read: vi.fn<NamedCheckExamplesRepository["read"]>(),
    };
    expect(
      checkUnderTestOf({
        ruleSet: { name, root: "tools/acme" },
        check: "scratch-file#scratch-files",
        engine: "walker",
        installRoot: absoluteRootOf("/install"),
        path: { resolve: vi.fn() },
        examples,
        loadFailureDetail: vi.fn<LoadFailureDetail>(),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "rule-set-invalid", detail },
    });
    expect(examples.read).not.toHaveBeenCalled();
  });

  it.each([
    {
      root: "../elsewhere",
      detail: "the root ../elsewhere of rule set acme is not a path inside the repository",
    },
    {
      root: "/abs/acme",
      detail: "the root /abs/acme of rule set acme is not a path inside the repository",
    },
  ])("refuses the root $root outside the repository before resolving it", ({ root, detail }) => {
    const resolve = vi.fn<PathPort["resolve"]>();
    expect(
      checkUnderTestOf({
        ruleSet: { name: "acme", root },
        check: "scratch-file#scratch-files",
        engine: "walker",
        installRoot: absoluteRootOf("/install"),
        path: { resolve },
        examples: { read: vi.fn<NamedCheckExamplesRepository["read"]>() },
        loadFailureDetail: vi.fn<LoadFailureDetail>(),
      }),
    ).toEqual({ outcome: "failed", error: { kind: "rule-set-invalid", detail } });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("refuses a root that does not resolve", () => {
    expect(
      checkUnderTestOf({
        ruleSet: { name: "acme", root: "tools/acme" },
        check: "scratch-file#scratch-files",
        engine: "walker",
        installRoot: absoluteRootOf("/install"),
        path: {
          resolve: vi.fn<PathPort["resolve"]>().mockReturnValueOnce({
            outcome: "failed",
            error: { kind: "working-directory-unusable", path: "tools/acme" },
          }),
        },
        examples: { read: vi.fn<NamedCheckExamplesRepository["read"]>() },
        loadFailureDetail: vi.fn<LoadFailureDetail>(),
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "rule-set-invalid",
        detail:
          "the root tools/acme of rule set acme does not resolve, because the working directory cannot be used",
      },
    });
  });
});

describe("checkUnderTestOf binding", () => {
  it("carries a team rule set's identity into the binding", () => {
    const one = editionOf("1");
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
            editions: { declared: [one], default: one, latest: one },
          },
          examples: [],
        },
      }),
    };

    const request = {
      ruleSet: { name: "acme", root: "tools/acme" },
      check: "scratch-file#scratch-files",
      engine: "walker",
      installRoot: absoluteRootOf("/install"),
      path: {
        resolve: vi
          .fn<PathPort["resolve"]>()
          .mockReturnValueOnce({ outcome: "ok", value: absoluteRootOf("/repo/tools/acme") }),
      },
      examples,
      loadFailureDetail: vi.fn<LoadFailureDetail>(),
    } as const;

    const checked = checkUnderTestOf(request);

    expect(checked).toEqual({
      outcome: "ok",
      value: {
        ruleSet: { name: "acme", root: "tools/acme" },
        check: "scratch-file#scratch-files",
        engine: "walker",
        binding: {
          address: "scratch-file#scratch-files",
          ruleSet: { name: "acme" },
          engine: "walker",
          anchor: { kind: "file" },
          pieceRoot: "/install/piece",
          settings: {},
          forms: {},
          checkSettings: {},
          edition: "1",
        },
        examples: [],
      },
    });
  });
});

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
      ruleSet: "hone",
      check: "example#sample",
      engine: "walker",
      installRoot: absoluteRootOf("/install"),
      moduleExtension: ".ts",
      modules: { load: vi.fn() },
      path: { join: vi.fn(), resolve: vi.fn() },
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

  it("runs a team's examples as a binding of the team's rule set", async () => {
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
        value: { piece: EDITION_ONE_PIECE, examples: [FIRST_EXAMPLE] },
      }),
    };
    await checkConformanceOf({
      ruleSet: { name: "acme", root: "tools/acme" },
      check: "scratch-file#scratch-files",
      engine: "walker",
      installRoot: absoluteRootOf("/install"),
      moduleExtension: ".ts",
      modules: { load: vi.fn() },
      path: {
        join: vi.fn(),
        resolve: vi
          .fn<PathPort["resolve"]>()
          .mockReturnValueOnce({ outcome: "ok", value: absoluteRootOf("/repo/tools/acme") }),
      },
      examples,
      enginePort,
      loadFailureDetail: vi.fn<LoadFailureDetail>(),
    });
    expect(enginePort.conform).toHaveBeenCalledExactlyOnceWith({
      binding: {
        address: "scratch-file#scratch-files",
        ruleSet: { name: "acme" },
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
