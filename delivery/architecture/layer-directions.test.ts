import { describe, expect, it } from "vitest";

type Layer =
  | "domain"
  | "ports"
  | "application"
  | "infrastructure"
  | "operations"
  | "composition"
  | "entry";

type Placement = Layer | "unplaced";

type Reach = Placement | "package" | "test-framework";

const TEST_FRAMEWORK = "vitest";

const TEST_FILE = /\.test\.ts$/;

const MAY_REACH: Readonly<Record<Placement, readonly Reach[]>> = {
  domain: ["domain"],
  ports: ["domain", "ports"],
  application: ["domain", "ports", "application"],
  infrastructure: ["domain", "ports", "infrastructure", "package"],
  operations: ["domain", "ports", "application", "operations"],
  composition: [
    "domain",
    "ports",
    "application",
    "infrastructure",
    "operations",
    "composition",
    "package",
  ],
  entry: [
    "domain",
    "ports",
    "application",
    "infrastructure",
    "operations",
    "composition",
    "entry",
    "package",
  ],
  unplaced: [],
};

const FOLDER_LAYERS: Readonly<Record<string, Layer>> = {
  domain: "domain",
  application: "application",
  infrastructure: "infrastructure",
  operations: "operations",
  composition: "composition",
};

type Violation = {
  readonly file: string;
  readonly specifier: string;
  readonly from: Placement;
  readonly to: Reach;
};

const STATIC_IMPORT =
  /^\s*(?:import|export)\s+(?:type\s+)?(?:[^;"']*?\s+from\s+)?["']([^"']+)["']/gm;

const DYNAMIC_IMPORT = /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g;

const specifiersIn = (request: { readonly text: string }): readonly string[] =>
  [...request.text.matchAll(STATIC_IMPORT), ...request.text.matchAll(DYNAMIC_IMPORT)].flatMap(
    (match) => match.slice(1, 2),
  );

const steppedInto = (segments: readonly string[], segment: string): readonly string[] => {
  if (segment === ".") {
    return segments;
  }
  if (segment === "..") {
    return segments.slice(0, -1);
  }
  return [...segments, segment];
};

const segmentsOf = (request: { readonly path: string }): readonly string[] =>
  request.path.split("/").reduce(steppedInto, []);

const resolvedSegmentsOf = (request: {
  readonly file: string;
  readonly specifier: string;
}): readonly string[] =>
  [...segmentsOf({ path: request.file }).slice(0, -1), ...request.specifier.split("/")].reduce(
    steppedInto,
    [],
  );

const placementOf = (request: { readonly segments: readonly string[] }): Placement => {
  const [root, folder, subfolder] = request.segments;
  if (root !== "src") {
    return "unplaced";
  }
  if (request.segments.length === 2) {
    return "entry";
  }
  if (folder === "application" && subfolder === "ports") {
    return "ports";
  }
  return FOLDER_LAYERS[folder ?? ""] ?? "unplaced";
};

const reachOf = (request: { readonly file: string; readonly specifier: string }): Reach => {
  if (request.specifier === TEST_FRAMEWORK) {
    return "test-framework";
  }
  return request.specifier.startsWith(".")
    ? placementOf({ segments: resolvedSegmentsOf(request) })
    : "package";
};

type Verdict = "allowed" | "forbidden";

const verdictOf = (request: {
  readonly file: string;
  readonly from: Placement;
  readonly to: Reach;
}): Verdict => {
  const reachable =
    request.to === "test-framework"
      ? TEST_FILE.test(request.file)
      : MAY_REACH[request.from].includes(request.to);
  return reachable ? "allowed" : "forbidden";
};

const violationsIn = (request: {
  readonly sources: Readonly<Record<string, string>>;
}): readonly Violation[] =>
  Object.entries(request.sources).flatMap(([file, text]) => {
    const from = placementOf({ segments: segmentsOf({ path: file }) });
    return specifiersIn({ text })
      .map((specifier) => ({ file, specifier, from, to: reachOf({ file, specifier }) }))
      .filter((violation) => verdictOf(violation) === "forbidden");
  });

const unplacedFilesIn = (request: {
  readonly sources: Readonly<Record<string, string>>;
}): readonly string[] =>
  Object.keys(request.sources).filter(
    (file) => placementOf({ segments: segmentsOf({ path: file }) }) === "unplaced",
  );

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: {
        readonly base: string;
        readonly query: "?raw";
        readonly import: "default";
        readonly eager: true;
      },
    ) => Readonly<Record<string, string>>;
  }
}

const sourceFiles = import.meta.glob(["./src/**/*.ts"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const WRITTEN_OUT_SOURCES: Readonly<Record<string, string>> = {
  "./src/domain/model.ts":
    'import type { Engine } from "../infrastructure/engine.ts";\nimport { z } from "zod";\n',
  "./src/application/ports/port.ts": 'import type { Use } from "../use.ts";\n',
  "./src/application/use.ts":
    'export { compose } from "../composition/compose.ts";\nimport type { Port } from "./ports/port.ts";\n',
  "./src/operations/operation.ts":
    'const loaded = await import("../infrastructure/engine.ts");\nimport { run } from "../application/use.ts";\n',
  "./src/infrastructure/engine.ts":
    'import { readFile } from "node:fs/promises";\nimport type { Model } from "../domain/model.ts";\nimport type { Port } from "../application/ports/port.ts";\n',
  "./src/composition/compose.ts":
    'import { z } from "zod";\nimport { operation } from "../operations/operation.ts";\n',
  "./src/hone.ts": 'import { compose } from "./composition/compose.ts";\n',
  "./src/domain/model.test.ts":
    'import { it } from "vitest";\nimport { createEngine } from "../infrastructure/engine.ts";\n',
  "./src/domain/untested.ts": 'import { it } from "vitest";\n',
  "./src/elsewhere/stray.ts": 'import type { Model } from "../domain/model.ts";\n',
};

describe("the layer direction reading over written-out sources, so the guard can fail", () => {
  it("reports each import that runs against the direction table, and nothing the table allows", () => {
    expect(violationsIn({ sources: WRITTEN_OUT_SOURCES })).toEqual([
      {
        file: "./src/domain/model.ts",
        specifier: "../infrastructure/engine.ts",
        from: "domain",
        to: "infrastructure",
      },
      { file: "./src/domain/model.ts", specifier: "zod", from: "domain", to: "package" },
      {
        file: "./src/application/ports/port.ts",
        specifier: "../use.ts",
        from: "ports",
        to: "application",
      },
      {
        file: "./src/application/use.ts",
        specifier: "../composition/compose.ts",
        from: "application",
        to: "composition",
      },
      {
        file: "./src/operations/operation.ts",
        specifier: "../infrastructure/engine.ts",
        from: "operations",
        to: "infrastructure",
      },
      {
        file: "./src/domain/model.test.ts",
        specifier: "../infrastructure/engine.ts",
        from: "domain",
        to: "infrastructure",
      },
      {
        file: "./src/domain/untested.ts",
        specifier: "vitest",
        from: "domain",
        to: "test-framework",
      },
      {
        file: "./src/elsewhere/stray.ts",
        specifier: "../domain/model.ts",
        from: "unplaced",
        to: "domain",
      },
    ]);
  });

  it("reports a source file outside every layer", () => {
    expect(unplacedFilesIn({ sources: WRITTEN_OUT_SOURCES })).toEqual(["./src/elsewhere/stray.ts"]);
  });
});

describe("the layer directions of every source and test file under src, read as build-time raw modules", () => {
  it("reads a known file from each layer, so the scan is not silently empty", () => {
    expect(sourceFiles).toEqual(
      expect.objectContaining({
        "./src/hone.ts": expect.any(String),
        "./src/domain/repository/projection-outputs.ts": expect.any(String),
        "./src/application/ports/host/path-port.ts": expect.any(String),
        "./src/application/run/run-report-of.ts": expect.any(String),
        "./src/infrastructure/node/path-port.ts": expect.any(String),
        "./src/operations/check/version-two-check-command.ts": expect.any(String),
        "./src/composition/commands.ts": expect.any(String),
        "./src/domain/result.test.ts": expect.any(String),
        "./src/infrastructure/node/path-port.test.ts": expect.any(String),
      }),
    );
  });

  it("finds every source file inside a layer", () => {
    expect(unplacedFilesIn({ sources: sourceFiles })).toEqual([]);
  });

  it("finds no import running against the direction table", () => {
    expect(violationsIn({ sources: sourceFiles })).toEqual([]);
  });
});
