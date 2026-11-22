import { describe, expect, it } from "vitest";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const entrySource = import.meta.glob(["./testing.ts"], {
  base: "./",
  query: "?raw",
  import: "default",
  eager: true,
});

const WIRING = `import { createConformanceTesting } from "./application/conformance/conformance-testing.ts";
import type { ClauseConformanceOf, ClauseUnderTestOf, RepoPathOf } from "./application/conformance/conformance-testing-types.ts";
import { installRootOfApiEntry } from "./infrastructure/command-line/installation/install-root.ts";
import { createRuleSetFileReader } from "./infrastructure/content-files/rule-sets/rule-set-file-reader.ts";
import { createDefaultFileTextPort } from "./infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "./infrastructure/node/modules/module-loader-port.ts";
import { createDefaultEnginePort } from "./infrastructure/engines/protocol/engine-port.ts";
import { createDefaultPathPort } from "./infrastructure/node/path-port.ts";
import { loadFailureDetail } from "./infrastructure/printed-report/load-failures/load-failure-text.ts";

export type {
  CaseUnderTest,
  ClauseRequest,
  ClauseUnderTest,
  ConformanceFailure,
  ConformanceSetupFailure,
  ConformanceSetupFailureKind,
} from "./application/conformance/conformance-testing-types.ts";

const path = createDefaultPathPort({});

const moduleUrl = import.meta.url;

const testing = createConformanceTesting({
  mechanism: "walker",
  moduleUrl,
  installRoot: installRootOfApiEntry({ path, moduleUrl }),
  ruleSetFiles: createRuleSetFileReader({ fileText: createDefaultFileTextPort({}), path }),
  loadFailureDetail,
  path,
  modules: createDefaultModuleLoaderPort({}),
  engine: createDefaultEnginePort({}),
});

export const clauseConformanceOf: ClauseConformanceOf = testing.clauseConformanceOf;

export const clauseUnderTestOf: ClauseUnderTestOf = testing.clauseUnderTestOf;

export const repoPathOf: RepoPathOf = testing.repoPathOf;
`;

describe("testing.ts, read as a build-time raw module (its behaviour is proven from the installed package by install-proof; importing it here would bind it to this checkout's runner)", () => {
  it("only wires createConformanceTesting to the audit mechanism, the default port factories, the install root above its own module URL, the rule-set file reader and the load failure printer", () => {
    expect(entrySource).toEqual({ "./testing.ts": WIRING });
  });
});
