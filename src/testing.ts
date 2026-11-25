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
import { runnerEnginesOver } from "./composition/runner-engines.ts";
import { installRootOfApiEntry } from "./infrastructure/command-line/installation/install-root.ts";
import { createNamedCheckExamplesRepository } from "./infrastructure/content-files/rule-sets/named-check-examples.ts";
import { namedCheckConformance } from "./infrastructure/engines/protocol/conformance.ts";
import { runnerModuleAt } from "./infrastructure/engines/protocol/runner-module/runner-module-at.ts";
import { createDefaultFileTextPort } from "./infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "./infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "./infrastructure/node/path-port.ts";
import { loadFailureDetail } from "./infrastructure/printed-report/load-failures/load-failure-text.ts";

export type { CheckBinding } from "./domain/runner/check-binding.ts";

export type {
  CaseUnderTest,
  CheckRequest,
  CheckConformanceFailure,
  CheckUnderTest,
  ConformanceSetupFailure,
  ConformanceSetupFailureKind,
  RuleSetUnderTest,
  TeamRuleSetUnderTest,
} from "./application/conformance/conformance-testing-types.ts";

const path = createDefaultPathPort({});

const moduleUrl = import.meta.url;

const installRoot = installRootOfApiEntry({ path, moduleUrl });
const fileText = createDefaultFileTextPort({});
const modules = createDefaultModuleLoaderPort({});
const examples = createNamedCheckExamplesRepository({ fileText, path });
const { namedEngine } = runnerEnginesOver({ runnerModuleOf: runnerModuleAt });

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
        path,
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
        enginePort: { load: namedEngine.load, conform: namedCheckConformance },
        moduleExtension: moduleExtensionOf({ moduleUrl }),
      });
