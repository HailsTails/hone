import { z } from "zod";

import type {
  ModuleLoad,
  ModuleLoaderPort,
} from "../../../../application/ports/host/module-loader-port.ts";
import type { Result } from "../../../../domain/result.ts";
import type { CheckBinding } from "../../../../domain/runner/check-binding.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import { runnerResultSchema } from "../../protocol/runner-module/runner-result-schema.ts";
import type { WalkerFile, WalkerRepository } from "./pieces/walker-piece.ts";
import type { SyntaxApi } from "./toolchain/typescript-parse.ts";

export type SelectedWalkerBinding = {
  readonly modulePath: string;
  readonly binding: CheckBinding;
};

export type LoadedPreparedWalkerCheck = {
  readonly prepareFile: (request: WalkerFile) => unknown;
  readonly finish: () => unknown;
};

export type PreparedWalkerPiece = {
  readonly modulePath: string;
  readonly bindings: readonly CheckBinding[];
  readonly check: LoadedPreparedWalkerCheck;
};

export type PrepareWalkerPiecesRequest = {
  readonly selected: readonly SelectedWalkerBinding[];
  readonly repository: WalkerRepository;
  readonly syntaxApi: SyntaxApi;
  readonly modules: ModuleLoaderPort;
};

export type PrepareWalkerPiecesResult = Result<readonly PreparedWalkerPiece[], RunnerFailure>;

type PreparedWalkerPieceResult = Result<PreparedWalkerPiece, RunnerFailure>;

const preparationCallSchema = z.function({
  input: [z.unknown()],
  output: z.unknown(),
});

const registeredWalkerPieceModuleSchema = z.object({
  check: z.object({ prepare: preparationCallSchema }),
});

const loadedPreparedWalkerCheckSchema = z.object({
  prepareFile: z.function({ input: [z.unknown()], output: z.unknown() }),
  finish: z.function({ input: [], output: z.unknown() }),
});

const walkerPreparationResultSchema = runnerResultSchema({
  value: loadedPreparedWalkerCheckSchema,
});

const pieceInvalid = (request: {
  readonly pieceRoot: string;
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } => ({
  outcome: "failed",
  error: {
    kind: "piece-invalid",
    pieceRoot: request.pieceRoot,
    detail: request.detail,
  },
});

type ImplementationGroup = {
  readonly selected: SelectedWalkerBinding;
  readonly bindings: CheckBinding[];
};

const groupsByImplementation = (request: {
  readonly selected: readonly SelectedWalkerBinding[];
}): readonly ImplementationGroup[] => {
  const groups = new Map<string, ImplementationGroup>();
  for (const selected of request.selected) {
    const group = groups.get(selected.modulePath);
    if (group === undefined) {
      groups.set(selected.modulePath, { selected, bindings: [selected.binding] });
    } else {
      group.bindings.push(selected.binding);
    }
  }
  return [...groups.values()];
};

const acceptedPreparation = (request: {
  readonly returned: unknown;
  readonly selected: SelectedWalkerBinding;
  readonly bindings: readonly CheckBinding[];
}): PreparedWalkerPieceResult => {
  const parsed = walkerPreparationResultSchema.safeParse(request.returned);
  if (!parsed.success) {
    return pieceInvalid({
      pieceRoot: request.selected.binding.pieceRoot,
      detail: parsed.error.message,
    });
  }
  if (parsed.data.outcome === "failed") {
    return parsed.data;
  }
  return {
    outcome: "ok",
    value: {
      modulePath: request.selected.modulePath,
      bindings: request.bindings,
      check: parsed.data.value,
    },
  };
};

const acceptedModule = (request: {
  readonly loaded: ModuleLoad;
  readonly selected: SelectedWalkerBinding;
  readonly bindings: readonly CheckBinding[];
  readonly repository: WalkerRepository;
  readonly syntaxApi: SyntaxApi;
}): PreparedWalkerPieceResult => {
  if (request.loaded.outcome === "failed") {
    return pieceInvalid({
      pieceRoot: request.selected.binding.pieceRoot,
      detail: request.loaded.error.detail,
    });
  }
  const parsed = registeredWalkerPieceModuleSchema.safeParse(request.loaded.value);
  if (!parsed.success) {
    return pieceInvalid({
      pieceRoot: request.selected.binding.pieceRoot,
      detail: parsed.error.message,
    });
  }
  try {
    return acceptedPreparation({
      returned: parsed.data.check.prepare({
        bindings: request.bindings,
        repository: request.repository,
        syntaxApi: request.syntaxApi,
      }),
      selected: request.selected,
      bindings: request.bindings,
    });
  } catch (thrown) {
    return pieceInvalid({
      pieceRoot: request.selected.binding.pieceRoot,
      detail: thrown instanceof Error ? thrown.message : String(thrown),
    });
  }
};

const loadModule = (request: {
  readonly group: ImplementationGroup;
  readonly preparation: PrepareWalkerPiecesRequest;
}): Promise<PreparedWalkerPieceResult> => {
  const { selected, bindings } = request.group;
  return request.preparation.modules.load({ path: selected.modulePath }).then((loaded) =>
    acceptedModule({
      loaded,
      selected,
      bindings,
      repository: request.preparation.repository,
      syntaxApi: request.preparation.syntaxApi,
    }),
  );
};

const collectPreparations = (request: {
  readonly preparations: readonly PreparedWalkerPieceResult[];
}): PrepareWalkerPiecesResult =>
  request.preparations.reduce<PrepareWalkerPiecesResult>(
    (gathered, next) => {
      if (gathered.outcome === "failed") {
        return gathered;
      }
      if (next.outcome === "failed") {
        return next;
      }
      return { outcome: "ok", value: [...gathered.value, next.value] };
    },
    { outcome: "ok", value: [] },
  );

export const prepareWalkerPieces = (
  request: PrepareWalkerPiecesRequest,
): Promise<PrepareWalkerPiecesResult> =>
  Promise.all(
    groupsByImplementation(request).map((group) => loadModule({ group, preparation: request })),
  ).then((preparations) => collectPreparations({ preparations }));
