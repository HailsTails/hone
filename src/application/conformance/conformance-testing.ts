import { installRootOfApiEntry } from "../../infrastructure/command-line/installation/install-root.ts";
import { loadFailureDetail } from "../../infrastructure/printed-report/load-failures/load-failure-text.ts";
import type { FileTextPort } from "../ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../ports/host/module-loader-port.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import type { MechanismId } from "../../domain/rule-set/identifier-types.ts";
import { moduleExtensionOf } from "../ports/host/module-extension.ts";
import { clauseConformanceOf } from "./clause-conformance.ts";
import { clauseUnderTestOf, repoPathOf } from "./clause-under-test.ts";
import type { ClauseConformanceOf, ClauseUnderTestOf, RepoPathOf } from "./conformance-testing-types.ts";

export type ConformanceTestingPorts = {
  readonly mechanism: MechanismId;
  readonly moduleUrl: string;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly modules: ModuleLoaderPort;
};

export type ConformanceTesting = {
  readonly clauseConformanceOf: ClauseConformanceOf;
  readonly clauseUnderTestOf: ClauseUnderTestOf;
  readonly repoPathOf: RepoPathOf;
};

export const createConformanceTesting = (ports: ConformanceTestingPorts): ConformanceTesting => ({
  clauseConformanceOf: (request) => {
    const installRoot = installRootOfApiEntry({ path: ports.path, moduleUrl: ports.moduleUrl });
    if (installRoot.outcome === "failed") {
      return Promise.resolve({
        outcome: "failed",
        error: { kind: "runner-unloadable", detail: loadFailureDetail({ failure: installRoot.error }) },
      });
    }
    return clauseConformanceOf({
      ruleSetRoot: request.ruleSetRoot,
      clause: request.clause,
      mechanism: ports.mechanism,
      fileText: ports.fileText,
      path: ports.path,
      modules: ports.modules,
      installRoot: installRoot.value,
      moduleExtension: moduleExtensionOf({ moduleUrl: ports.moduleUrl }),
    });
  },
  clauseUnderTestOf: (request) => {
    const installRoot = installRootOfApiEntry({ path: ports.path, moduleUrl: ports.moduleUrl });
    if (installRoot.outcome === "failed") {
      return { outcome: "failed", error: { kind: "rule-set-unloadable", detail: loadFailureDetail({ failure: installRoot.error }) } };
    }
    return clauseUnderTestOf({
      ruleSetRoot: request.ruleSetRoot,
      clause: request.clause,
      mechanism: ports.mechanism,
      fileText: ports.fileText,
      path: ports.path,
      installRoot: installRoot.value,
    });
  },
  repoPathOf,
});
