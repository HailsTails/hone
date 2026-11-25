import type { FileTextPort } from "../../../src/application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../src/application/ports/host/path-port.ts";
import type { CheckAddressText } from "../../../src/domain/language-layer/check-address-text.ts";
import type { AbsolutePath } from "../../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../../src/domain/result.ts";
import { editionReaches } from "../../../src/domain/rule-set/edition-reach.ts";
import type { CheckBinding } from "../../../src/domain/runner/check-binding.ts";
import type { NamedChecksRunner } from "../../../src/infrastructure/engines/protocol/checks/checks-runner-types.ts";
import { createWalkerRunner } from "../../../src/infrastructure/engines/walker/runner/create-walker-runner.ts";
import type { TypeScriptParsePort } from "../../../src/infrastructure/engines/walker/runner/toolchain/typescript-parse.ts";
import { createDefaultEntryKindPort } from "../../../src/infrastructure/node/file-system/file-system-port.ts";
import { createDefaultModuleLoaderPort } from "../../../src/infrastructure/node/modules/module-loader-port.ts";
import { BLOCK_FILE, createBlockText } from "./block-text.ts";
import type { FlaggedFormsPort } from "./block-verdicts-port.ts";

export type CreateBlockRunner = (request: {
  readonly blockPath: string;
  readonly text: string;
}) => Pick<NamedChecksRunner, "run">;

type FlaggedFormsSource = {
  readonly createRunner: CreateBlockRunner;
  readonly path: Pick<PathPort, "join">;
  readonly repoRoot: AbsolutePath;
};

const createBlockFileText = (request: {
  readonly fileText: FileTextPort;
  readonly blockPath: string;
  readonly text: string;
}): FileTextPort => ({
  ...request.fileText,
  read: (reading) =>
    reading.path === request.blockPath
      ? { outcome: "ok", value: request.text }
      : request.fileText.read(reading),
  exists: (probing) =>
    probing.path === request.blockPath ? "present" : request.fileText.exists(probing),
});

const listNewestBindings = (request: {
  readonly check: CheckAddressText;
  readonly bindings: readonly CheckBinding[];
}): readonly CheckBinding[] => {
  const candidates = request.bindings.filter(
    ({ engine, address }) => engine === "walker" && address === request.check,
  );
  return candidates.filter(({ edition }) =>
    candidates.every(
      (other) => editionReaches({ edition, introducedIn: other.edition }) === "reached",
    ),
  );
};

const readFlaggedForms = async (
  request: FlaggedFormsSource & {
    readonly source: string;
    readonly check: CheckAddressText;
    readonly bindings: readonly CheckBinding[];
  },
): Promise<Result<readonly string[], string>> => {
  const { createRunner, path, repoRoot, source } = request;
  const runner = createRunner({
    blockPath: path.join({ segments: [repoRoot, BLOCK_FILE] }),
    text: createBlockText({ source }),
  });
  const report = await runner.run({
    repoRoot,
    installRoot: repoRoot,
    files: [BLOCK_FILE],
    trackedPaths: [BLOCK_FILE],
    bindings: listNewestBindings(request),
    answered: [],
    declaredConfigRoots: [],
    declaredConfigLookup: undefined,
    testFiles: { suffixes: ["test", "spec"], folders: [] },
  });
  return report.outcome === "failed"
    ? { outcome: "failed", error: `the walker run failed: ${report.error.kind}` }
    : {
        outcome: "ok",
        value: report.value.hits.flatMap(({ remedy }) =>
          remedy === undefined ? [] : [remedy.form],
        ),
      };
};

export const createFlaggedFormsPort = (options: FlaggedFormsSource): FlaggedFormsPort => ({
  read: (request) => readFlaggedForms({ ...options, ...request }),
});

export const createDefaultFlaggedFormsPort = (options: {
  readonly parse: TypeScriptParsePort;
  readonly repoRoot: AbsolutePath;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
}): FlaggedFormsPort => {
  const { parse, repoRoot, fileText, path } = options;
  return createFlaggedFormsPort({
    createRunner: (block) =>
      createWalkerRunner({
        fileText: createBlockFileText({ ...block, fileText }),
        modules: createDefaultModuleLoaderPort({}),
        path,
        parse,
        entryKind: createDefaultEntryKindPort({}),
      }),
    path,
    repoRoot,
  });
};
