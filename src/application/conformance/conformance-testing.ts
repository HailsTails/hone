import type { LoadFailure } from "../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../domain/result.ts";
import type { EngineId } from "../../domain/rule-set/identifier-types.ts";
import type { EnginePort } from "../ports/engine/engine-port.ts";
import { moduleExtensionOf } from "../ports/host/module-extension.ts";
import type { ModuleLoaderPort } from "../ports/host/module-loader-port.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import type { LoadFailureDetail } from "../ports/report/load-failure-detail.ts";
import type { RuleSetFiles } from "../ports/rule-set/rule-set-files.ts";
import { clauseConformanceOf } from "./clause-conformance.ts";
import { clauseUnderTestOf, repoPathOf } from "./clause-under-test.ts";
import type {
  ClauseConformanceOf,
  ClauseUnderTestOf,
  RepoPathOf,
} from "./conformance-testing-types.ts";

export type ConformanceTestingPorts = {
  readonly mechanism: EngineId;
  readonly moduleUrl: string;
  readonly installRoot: Result<AbsolutePath, LoadFailure>;
  readonly ruleSetFiles: RuleSetFiles;
  readonly loadFailureDetail: LoadFailureDetail;
  readonly path: PathPort;
  readonly modules: ModuleLoaderPort;
  readonly engine: EnginePort;
};

export type ConformanceTesting = {
  readonly clauseConformanceOf: ClauseConformanceOf;
  readonly clauseUnderTestOf: ClauseUnderTestOf;
  readonly repoPathOf: RepoPathOf;
};

export const createConformanceTesting = (ports: ConformanceTestingPorts): ConformanceTesting => ({
  clauseConformanceOf: (request) => {
    if (ports.installRoot.outcome === "failed") {
      return Promise.resolve({
        outcome: "failed",
        error: {
          kind: "runner-unloadable",
          detail: ports.loadFailureDetail({ failure: ports.installRoot.error }),
        },
      });
    }
    return clauseConformanceOf({
      ruleSetRoot: request.ruleSetRoot,
      clause: request.clause,
      mechanism: ports.mechanism,
      ruleSetFiles: ports.ruleSetFiles,
      loadFailureDetail: ports.loadFailureDetail,
      path: ports.path,
      modules: ports.modules,
      engine: ports.engine,
      installRoot: ports.installRoot.value,
      moduleExtension: moduleExtensionOf({ moduleUrl: ports.moduleUrl }),
    });
  },
  clauseUnderTestOf: (request) => {
    if (ports.installRoot.outcome === "failed") {
      return {
        outcome: "failed",
        error: {
          kind: "rule-set-unloadable",
          detail: ports.loadFailureDetail({ failure: ports.installRoot.error }),
        },
      };
    }
    return clauseUnderTestOf({
      ruleSetRoot: request.ruleSetRoot,
      clause: request.clause,
      mechanism: ports.mechanism,
      ruleSetFiles: ports.ruleSetFiles,
      loadFailureDetail: ports.loadFailureDetail,
      path: ports.path,
      installRoot: ports.installRoot.value,
    });
  },
  repoPathOf,
});
