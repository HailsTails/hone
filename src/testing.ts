import {
  checkConformanceOf as conformNamedCheck,
  checkUnderTestOf as namedCheckUnderTest,
  repoPathOf as checkedRepoPath,
} from "./application/conformance/check-conformance.ts";
import type {
  CheckConformanceOf,
  CheckUnderTestOf,
  RepoPathOf,
} from "./application/conformance/conformance-testing-types.ts";
import { moduleExtensionOf } from "./application/ports/host/module-extension.ts";
import { installRootOfApiEntry } from "./infrastructure/command-line/installation/install-root.ts";
import { createNamedCheckExamplesRepository } from "./infrastructure/content-files/rule-sets/named-check-examples.ts";
import { createNamedConformancePort } from "./infrastructure/engines/protocol/engine-port.ts";
import { createDefaultFileTextPort } from "./infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "./infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "./infrastructure/node/path-port.ts";
import { loadFailureDetail } from "./infrastructure/printed-report/load-failures/load-failure-text.ts";

export type {
  CaseUnderTest,
  CheckRequest,
  CheckConformanceFailure,
  CheckUnderTest,
  ConformanceSetupFailure,
  ConformanceSetupFailureKind,
} from "./application/conformance/conformance-testing-types.ts";

const path = createDefaultPathPort({});

const moduleUrl = import.meta.url;

const installRoot = installRootOfApiEntry({ path, moduleUrl });
const fileText = createDefaultFileTextPort({});
const modules = createDefaultModuleLoaderPort({});
const examples = createNamedCheckExamplesRepository({ fileText, path });

export const repoPathOf: RepoPathOf = checkedRepoPath;

export const checkUnderTestOf: CheckUnderTestOf = (request) =>
  installRoot.outcome === "failed"
    ? {
        outcome: "failed",
        error: {
          kind: "rule-set-unloadable",
          detail: loadFailureDetail({ failure: installRoot.error }),
        },
      }
    : namedCheckUnderTest({
        ...request,
        installRoot: installRoot.value,
        examples,
        loadFailureDetail,
      });

export const checkConformanceOf: CheckConformanceOf = (request) =>
  installRoot.outcome === "failed"
    ? Promise.resolve({
        outcome: "failed",
        error: {
          kind: "runner-unloadable",
          detail: loadFailureDetail({ failure: installRoot.error }),
        },
      })
    : conformNamedCheck({
        ...request,
        installRoot: installRoot.value,
        examples,
        loadFailureDetail,
        path,
        modules,
        enginePort: createNamedConformancePort({}),
        moduleExtension: moduleExtensionOf({ moduleUrl }),
      });
