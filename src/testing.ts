import { createConformanceTesting } from "./application/conformance/conformance-testing.ts";
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
