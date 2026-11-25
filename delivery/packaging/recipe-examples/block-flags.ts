import { gatheredOutcomes } from "../../../src/domain/gathered-outcomes.ts";
import type { CheckAddressText } from "../../../src/domain/language-layer/check-address-text.ts";
import type { Result } from "../../../src/domain/result.ts";
import type { EngineId } from "../../../src/domain/rule-set/identifier-types.ts";
import type { SourceCase } from "../../../src/domain/rule-set/rule-set-types.ts";
import type { CheckBinding } from "../../../src/domain/runner/check-binding.ts";
import { namedCheckConformance } from "../../../src/infrastructure/engines/protocol/conformance.ts";
import { BLOCK_FILE, createBlockName, createBlockText, createTestText } from "./block-text.ts";
import type { BlockFlag, BlockFlagsPort } from "./block-verdicts-port.ts";
import type { ExampleBlock } from "./example-block.ts";

export type ConformingRunner = {
  readonly conform: (request: {
    readonly binding: CheckBinding;
    readonly cases: readonly SourceCase[];
  }) => Promise<unknown>;
};

type RunnersByEngine = Readonly<Record<EngineId, ConformingRunner>>;

const ASSERTION_SITE: CheckAddressText = "assertion-outside-a-test-body#assertion-site";

const createCase = (request: {
  readonly block: ExampleBlock;
  readonly binding: CheckBinding;
}): SourceCase => ({
  name: createBlockName(request),
  fileName: BLOCK_FILE,
  source:
    request.binding.address === ASSERTION_SITE
      ? createTestText(request.block)
      : createBlockText(request.block),
  expectedLines: [],
});

const readFlagsOfBinding = async (request: {
  readonly runners: RunnersByEngine;
  readonly binding: CheckBinding;
  readonly blocks: readonly ExampleBlock[];
}): Promise<Result<readonly BlockFlag[], string>> => {
  const { binding, blocks } = request;
  const conformed = await namedCheckConformance({
    binding,
    cases: blocks.map((block) => createCase({ block, binding })),
    runner: request.runners[binding.engine],
  });
  return conformed.outcome === "failed"
    ? {
        outcome: "failed",
        error: `${binding.address} on ${binding.engine}: ${conformed.error.kind}`,
      }
    : {
        outcome: "ok",
        value: conformed.value.flatMap(({ caseName, check, flaggedLines }) =>
          blocks
            .filter((block) => createBlockName({ block }) === caseName)
            .map((block) => ({ block, check, lines: flaggedLines })),
        ),
      };
};

const readFlags = async (request: {
  readonly runners: RunnersByEngine;
  readonly bindings: readonly CheckBinding[];
  readonly blocks: readonly ExampleBlock[];
}): Promise<Result<readonly BlockFlag[], string>> => {
  const flagged = await Promise.all(
    request.bindings.map((binding) => readFlagsOfBinding({ ...request, binding })),
  );
  return gatheredOutcomes({ outcomes: flagged });
};

export const createBlockFlagsPort = (options: {
  readonly runners: RunnersByEngine;
}): BlockFlagsPort => ({
  read: (request) => readFlags({ ...options, ...request }),
});
