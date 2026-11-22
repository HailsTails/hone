import type { LoadFailure } from "../../domain/report/load-failure.ts";
import type { ClauseSettingValues } from "../../domain/runner/runner-module-types.ts";
import { createDefaultFileTextPort } from "../node/file-system/file-text-port.ts";
import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../node/path-port.ts";
import type { PathPort } from "../../application/ports/host/path-port.ts";
import { pieceFolderSegmentsOf } from "../../domain/rule-set/piece-folder.ts";
import type { ClauseExceptions, ClauseSettingDeclarations, DisciplineFile, PieceFile } from "../../domain/rule-set/rule-set-types.ts";
import { settledClauseEdition } from "../../domain/settings/clause-settings/clause-edition.ts";
import { settledClauseSettings } from "./clause-settings.ts";
import { defaultClauseSettings } from "../../domain/settings/clause-settings/default-clause-settings.ts";
import { editionPinOf } from "../../domain/settings/clause-settings/edition-pin.ts";
import type { RunSettings } from "../../domain/settings/run-settings.ts";
import type { ReportOutput } from "../../domain/settings/report-output.ts";
import type { ClauseBinding, ClauseEditionReading, SelectionReading } from "../../domain/settings/selection/selection.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { ClauseAddress } from "../../domain/rule-set/clause-address-types.ts";
import { clauseAddressText, sameClauseAddress, TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import type { ClauseEditions } from "../../domain/rule-set/edition-types.ts";
import type { EngineId } from "../../domain/rule-set/identifier-types.ts";
import type { ModuleExtension } from "../../application/ports/host/module-extension.ts";
import type { Result } from "../../domain/result.ts";
import { createRuleSetFiles, type RuleSetFiles } from "../content-files/rule-sets/rule-set-files.ts";
import { runSettingsOf } from "./selection-file.ts";
import type { ConsumerSelectionFile, RuleSetLocation, UnrunState } from "../../domain/settings/selection/selection-file.ts";
import { readSelectionFile, selectionFilePathOf } from "./selection-reader.ts";
import type { SelectionRepository } from "../../application/ports/selection/selection-repository.ts";

export const createSelectionRepository = (options: {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
}): SelectionRepository => ({
  read: (_request) => readSelection(options),
});

export const createDefaultSelectionRepository = (options: {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
}): SelectionRepository => createSelectionRepository({
  ...options,
  fileText: createDefaultFileTextPort({}),
  path: createDefaultPathPort({}),
});

type ResolvedClause = {
  readonly ruleSetRoot: AbsolutePath;
  readonly discipline: DisciplineFile;
  readonly piece: PieceFile;
  readonly binding: ClauseBinding;
  readonly exceptions: ClauseExceptions;
  readonly declarations: ClauseSettingDeclarations;
  readonly editions: ClauseEditions;
};

const failed = (error: LoadFailure): { readonly outcome: "failed"; readonly error: LoadFailure } => ({
  outcome: "failed",
  error,
});

export const ruleSetRootOf = (request: {
  readonly ruleSet: ClauseAddress["ruleSet"];
  readonly ruleSets: Readonly<Record<string, RuleSetLocation>>;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly path: PathPort;
}): Result<AbsolutePath, LoadFailure> => {
  const ruleSet = request.ruleSet;
  if (ruleSet === TOOL_RULE_SET) {
    return { outcome: "ok", value: request.installRoot };
  }
  const declared = Object.entries(request.ruleSets).find(([name]) => name === ruleSet.name);
  if (declared === undefined) {
    return failed({ kind: "unknown-rule-set", name: ruleSet.name });
  }
  const location = declared[1];
  if (location.location === "repo-root") {
    return { outcome: "ok", value: request.repoRoot };
  }
  const directory = request.path.join({ segments: [request.repoRoot, location.path] });
  const resolved = request.path.resolve({ path: directory });
  if (resolved.outcome === "failed") {
    return failed({
      kind: "rule-set-invalid",
      path: directory,
      detail: `the directory of rule set ${ruleSet.name} resolves to no absolute path`,
    });
  }
  return { outcome: "ok", value: resolved.value };
};

type ClauseRequest = {
  readonly ruleSetFiles: RuleSetFiles;
  readonly path: PathPort;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly ruleSetRoot: AbsolutePath;
  readonly address: ClauseAddress;
  readonly mechanism: EngineId;
  readonly earlier: readonly ResolvedClause[];
};

type MechanicalDefinition = Extract<DisciplineFile["clauses"][number], { readonly kind: "mechanical" }>;

type DefinedClause = {
  readonly discipline: DisciplineFile;
  readonly definition: MechanicalDefinition;
};

const disciplineOf = (request: Omit<ClauseRequest, "mechanism">): Result<DisciplineFile, LoadFailure> => {
  const loaded = request.earlier.find(
    (earlier) =>
      earlier.ruleSetRoot === request.ruleSetRoot && earlier.discipline.id === request.address.discipline,
  );
  if (loaded !== undefined) {
    return { outcome: "ok", value: loaded.discipline };
  }
  const held = request.ruleSetFiles.discipline({ ruleSetRoot: request.ruleSetRoot, installRoot: request.installRoot, discipline: request.address.discipline });
  if (held.outcome === "failed") {
    return held;
  }
  return held.value.held === "absent"
    ? failed({ kind: "unknown-discipline", address: clauseAddressText({ address: request.address }) })
    : { outcome: "ok", value: held.value.file };
};

type JudgementRefusal = "judgement-clause-selected" | "judgement-clause-listed";

const mechanicalClause = (
  request: Omit<ClauseRequest, "mechanism"> & { readonly judgementRefusal: JudgementRefusal },
): Result<DefinedClause, LoadFailure> => {
  const address = clauseAddressText({ address: request.address });
  const discipline = disciplineOf(request);
  if (discipline.outcome === "failed") {
    return discipline;
  }
  const definition = discipline.value.clauses.find((clause) => clause.id === request.address.clause);
  if (definition === undefined) {
    return failed({ kind: "unknown-clause", address });
  }
  if (definition.kind === "judgement") {
    return failed({ kind: request.judgementRefusal, address });
  }
  return { outcome: "ok", value: { discipline: discipline.value, definition } };
};

const definedClause = (request: ClauseRequest): Result<DefinedClause, LoadFailure> => {
  const defined = mechanicalClause({ ...request, judgementRefusal: "judgement-clause-selected" });
  if (defined.outcome === "failed") {
    return defined;
  }
  if (!defined.value.definition.mechanisms.includes(request.mechanism)) {
    return failed({ kind: "mechanism-not-allowed", address: clauseAddressText({ address: request.address }), mechanism: request.mechanism });
  }
  return defined;
};

type PieceRequest = ClauseRequest & { readonly discipline: DisciplineFile };

const pieceMissing = (request: PieceRequest): LoadFailure => ({
  kind: "piece-missing",
  address: clauseAddressText({ address: request.address }),
  mechanism: request.mechanism,
});

const pieceOf = (request: PieceRequest): Result<PieceFile, LoadFailure> => {
  const loaded = request.earlier.find(
    (earlier) =>
      earlier.ruleSetRoot === request.ruleSetRoot &&
      earlier.discipline.id === request.address.discipline &&
      earlier.binding.mechanism === request.mechanism,
  );
  if (loaded !== undefined) {
    return { outcome: "ok", value: loaded.piece };
  }
  const held = request.ruleSetFiles.piece({ ruleSetRoot: request.ruleSetRoot, installRoot: request.installRoot, discipline: request.discipline, mechanism: request.mechanism });
  if (held.outcome === "failed") {
    return held;
  }
  return held.value.held === "absent" ? failed(pieceMissing(request)) : { outcome: "ok", value: held.value.file };
};

type PieceEntry = {
  readonly piece: PieceFile;
  readonly settings: unknown;
  readonly declarations: ClauseSettingDeclarations;
  readonly editions: ClauseEditions;
};

const pieceEntry = (request: PieceRequest): Result<PieceEntry, LoadFailure> => {
  const runner = request.ruleSetFiles.runner({
    installRoot: request.installRoot,
    mechanism: request.mechanism,
    moduleExtension: request.moduleExtension,
  });
  if (runner === "absent") {
    return failed({ kind: "runner-missing", mechanism: request.mechanism });
  }
  const piece = pieceOf(request);
  if (piece.outcome === "failed") {
    return piece;
  }
  const entry = piece.value.clauses.find((candidate) => candidate.clause === request.address.clause);
  if (entry === undefined) {
    return failed(pieceMissing(request));
  }
  return { outcome: "ok", value: { piece: piece.value, settings: entry.settings, declarations: entry.clauseSettings, editions: entry.editions } };
};

const resolvedClauseOf = (request: {
  readonly clauseRequest: ClauseRequest;
  readonly defined: DefinedClause;
  readonly entry: PieceEntry;
}): ResolvedClause => {
  const { clauseRequest, defined, entry } = request;
  return {
    ruleSetRoot: clauseRequest.ruleSetRoot,
    discipline: defined.discipline,
    piece: entry.piece,
    exceptions: defined.definition.exceptions,
    declarations: entry.declarations,
    editions: entry.editions,
    binding: {
      mechanism: clauseRequest.mechanism,
      clause: {
        address: clauseRequest.address,
        anchor: defined.definition.anchor,
        pieceRoot: clauseRequest.path.join({
          segments: pieceFolderSegmentsOf({
            ruleSetRoot: clauseRequest.ruleSetRoot,
            installRoot: clauseRequest.installRoot,
            mechanism: clauseRequest.mechanism,
            discipline: clauseRequest.address.discipline,
          }),
        }),
        settings: entry.settings,
        clauseSettings: defaultClauseSettings({ declarations: entry.declarations }),
        edition: entry.editions.default,
      },
    },
  };
};

const resolveClause = (request: {
  readonly ruleSetFiles: RuleSetFiles;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly ruleSets: ConsumerSelectionFile["ruleSets"];
  readonly address: ClauseAddress;
  readonly mechanism: EngineId;
  readonly earlier: readonly ResolvedClause[];
}): Result<ResolvedClause, LoadFailure> => {
  const root = ruleSetRootOf({ ...request, ruleSet: request.address.ruleSet, ruleSets: Object.fromEntries(request.ruleSets) });
  if (root.outcome === "failed") {
    return root;
  }
  const clauseRequest = { ...request, ruleSetRoot: root.value };
  const defined = definedClause(clauseRequest);
  if (defined.outcome === "failed") {
    return defined;
  }
  const entry = pieceEntry({ ...clauseRequest, discipline: defined.value.discipline });
  if (entry.outcome === "failed") {
    return entry;
  }
  return { outcome: "ok", value: resolvedClauseOf({ clauseRequest, defined: defined.value, entry: entry.value }) };
};

const addressOf = (request: { readonly resolved: ResolvedClause }): ClauseAddress =>
  request.resolved.binding.clause.address;

type ListedClause = {
  readonly discipline: DisciplineFile;
  readonly address: ClauseAddress;
};

const occurrenceInDiscipline = (request: {
  readonly listed: readonly ListedClause[];
  readonly clause: ListedClause;
  readonly index: number;
}): "first" | "repeat" => {
  const address = request.clause.address;
  const firstIndex = request.listed.findIndex(
    (earlier) => sameClauseAddress({ left: { ...earlier.address, clause: address.clause }, right: address }) === "same",
  );
  return firstIndex === request.index ? "first" : "repeat";
};

const listingOf = (request: {
  readonly listed: readonly ListedClause[];
  readonly address: ClauseAddress;
}): "listed" | "unlisted" =>
  request.listed.some((listed) => sameClauseAddress({ left: listed.address, right: request.address }) === "same")
    ? "listed"
    : "unlisted";

const unlistedClausesOf = (request: {
  readonly listed: readonly ListedClause[];
  readonly representative: ListedClause;
}): readonly ClauseAddress[] =>
  request.representative.discipline.clauses
    .filter((definition) => definition.kind === "mechanical")
    .map((definition): ClauseAddress => ({ ...request.representative.address, clause: definition.id }))
    .filter((address) => listingOf({ listed: request.listed, address }) === "unlisted");

const uncoveredClauses = (request: { readonly listed: readonly ListedClause[] }): readonly ClauseAddress[] =>
  request.listed
    .filter((clause, index) => occurrenceInDiscipline({ listed: request.listed, clause, index }) === "first")
    .flatMap((representative) => unlistedClausesOf({ listed: request.listed, representative }));

type SelectionRequest = {
  readonly ruleSetFiles: RuleSetFiles;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly file: ConsumerSelectionFile;
  readonly filePath: string;
};

const adoptedEntries = (request: { readonly file: ConsumerSelectionFile }): readonly (readonly [ClauseAddress, EngineId])[] =>
  request.file.clauses.flatMap(([address, choice]): readonly (readonly [ClauseAddress, EngineId])[] =>
    choice.state === "run" ? [[address, choice.mechanism]] : [],
  );

const unrunEntries = (request: { readonly file: ConsumerSelectionFile }): readonly (readonly [ClauseAddress, UnrunState])[] =>
  request.file.clauses.flatMap(([address, choice]): readonly (readonly [ClauseAddress, UnrunState])[] =>
    choice.state === "run" ? [] : [[address, choice.state]],
  );

const resolvedClauses = (request: SelectionRequest): Result<readonly ResolvedClause[], LoadFailure> =>
  adoptedEntries(request).reduce<Result<readonly ResolvedClause[], LoadFailure>>(
    (sofar, [address, mechanism]) =>
      appendedClause({
        sofar,
        resolve: ({ earlier }) =>
          resolveClause({ ...request, ruleSets: request.file.ruleSets, address, mechanism, earlier }),
      }),
    { outcome: "ok", value: [] },
  );

type UnrunRequest = SelectionRequest & { readonly adopted: readonly ResolvedClause[] };

type UnrunClause = ListedClause & { readonly state: UnrunState };

const unrunClause = (
  request: UnrunRequest & { readonly address: ClauseAddress; readonly state: UnrunState },
): Result<UnrunClause, LoadFailure> => {
  const root = ruleSetRootOf({
    ...request,
    ruleSet: request.address.ruleSet,
    ruleSets: Object.fromEntries(request.file.ruleSets),
  });
  if (root.outcome === "failed") {
    return root;
  }
  const defined = mechanicalClause({
    ...request,
    ruleSetRoot: root.value,
    earlier: request.adopted,
    judgementRefusal: "judgement-clause-listed",
  });
  return defined.outcome === "failed"
    ? defined
    : { outcome: "ok", value: { discipline: defined.value.discipline, address: request.address, state: request.state } };
};

const unrunClauses = (request: UnrunRequest): Result<readonly UnrunClause[], LoadFailure> =>
  unrunEntries(request).reduce<Result<readonly UnrunClause[], LoadFailure>>(
    (sofar, [address, state]) => appendedClause({ sofar, resolve: () => unrunClause({ ...request, address, state }) }),
    { outcome: "ok", value: [] },
  );

const addressesIn = (request: { readonly unrun: readonly UnrunClause[]; readonly state: UnrunState }): readonly ClauseAddress[] =>
  request.unrun.filter((clause) => clause.state === request.state).map((clause) => clause.address);

const appendedClause = <Clause>(request: {
  readonly sofar: Result<readonly Clause[], LoadFailure>;
  readonly resolve: (resolution: { readonly earlier: readonly Clause[] }) => Result<Clause, LoadFailure>;
}): Result<readonly Clause[], LoadFailure> => {
  if (request.sofar.outcome === "failed") {
    return request.sofar;
  }
  const clause = request.resolve({ earlier: request.sofar.value });
  if (clause.outcome === "failed") {
    return clause;
  }
  return { outcome: "ok", value: [...request.sofar.value, clause.value] };
};

const editionReadingsOf = (request: { readonly resolved: readonly ResolvedClause[] }): readonly ClauseEditionReading[] =>
  request.resolved
    .filter(({ editions }) => editions.declared.length > 1)
    .map(({ binding, editions }) => ({
      address: binding.clause.address,
      mechanism: binding.mechanism,
      edition: binding.clause.edition,
      latest: editions.latest,
    }));

const selectionReadingOf = (request: {
  readonly resolved: readonly ResolvedClause[];
  readonly unrun: readonly UnrunClause[];
  readonly file: ConsumerSelectionFile;
}): SelectionReading => ({
  selection: {
    selected: request.resolved.map(({ binding, exceptions }) => ({
      address: binding.clause.address,
      mechanism: binding.mechanism,
      exceptions,
    })),
    uncovered: uncoveredClauses({
      listed: [
        ...request.resolved.map((resolved) => ({ discipline: resolved.discipline, address: addressOf({ resolved }) })),
        ...request.unrun,
      ],
    }),
    notAdopted: addressesIn({ unrun: request.unrun, state: "not-adopted" }),
    notRun: addressesIn({ unrun: request.unrun, state: "not-run" }),
    editions: editionReadingsOf({ resolved: request.resolved }),
  },
  bindings: request.resolved.map(({ binding }) => binding),
  clauseRoots: request.resolved.map((resolved) => ({ clause: addressOf({ resolved }), ruleSetRoot: resolved.ruleSetRoot })),
  excluded: request.file.exclude,
  eslintConfigRoots: request.file.eslintConfigRoots,
  fileExceptionWhyChains: request.file.fileExceptionWhyChains,
});

const givenClauseSettings = (request: {
  readonly file: ConsumerSelectionFile;
  readonly address: ClauseAddress;
}): ClauseSettingValues | undefined =>
  request.file.clauseSettings.find(([address]) => sameClauseAddress({ left: address, right: request.address }) === "same")?.[1];

const settledClause = (request: {
  readonly clause: ResolvedClause;
  readonly file: ConsumerSelectionFile;
  readonly path: string;
}): Result<ResolvedClause, LoadFailure> => {
  const address = addressOf({ resolved: request.clause });
  const { pin, rest } = editionPinOf({ given: givenClauseSettings({ file: request.file, address }) });
  const edition = settledClauseEdition({ address, editions: request.clause.editions, pin, checkEditions: request.file.checkEditions });
  if (edition.outcome === "failed") {
    return failed({ kind: "file-malformed", path: request.path, detail: edition.error });
  }
  const clauseSettings = settledClauseSettings({ address, declarations: request.clause.declarations, given: rest });
  if (clauseSettings.outcome === "failed") {
    return failed({ kind: "file-malformed", path: request.path, detail: clauseSettings.error });
  }
  const { binding } = request.clause;
  return {
    outcome: "ok",
    value: {
      ...request.clause,
      binding: { ...binding, clause: { ...binding.clause, clauseSettings: clauseSettings.value, edition: edition.value } },
    },
  };
};

const withClauseSettings = (request: {
  readonly resolved: readonly ResolvedClause[];
  readonly file: ConsumerSelectionFile;
  readonly path: string;
}): Result<readonly ResolvedClause[], LoadFailure> =>
  request.resolved.reduce<Result<readonly ResolvedClause[], LoadFailure>>(
    (sofar, clause) =>
      appendedClause({ sofar, resolve: () => settledClause({ clause, file: request.file, path: request.path }) }),
    { outcome: "ok", value: [] },
  );

export const readRunSettings = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
}): Result<RunSettings<ReportOutput>, LoadFailure> => {
  const file = readSelectionFile({ fileText: request.fileText, path: selectionFilePathOf(request) });
  return file.outcome === "failed" ? file : { outcome: "ok", value: runSettingsOf({ file: file.value }) };
};

export const selectionFrom = (request: SelectionRequest): Result<SelectionReading, LoadFailure> => {
  const resolved = resolvedClauses(request);
  if (resolved.outcome === "failed") {
    return resolved;
  }
  const settled = withClauseSettings({ resolved: resolved.value, file: request.file, path: request.filePath });
  if (settled.outcome === "failed") {
    return settled;
  }
  const unrun = unrunClauses({ ...request, adopted: settled.value });
  if (unrun.outcome === "failed") {
    return unrun;
  }
  return { outcome: "ok", value: selectionReadingOf({ resolved: settled.value, unrun: unrun.value, file: request.file }) };
};

export const readSelection = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
}): Result<SelectionReading, LoadFailure> => {
  const filePath = selectionFilePathOf(request);
  const file = readSelectionFile({ fileText: request.fileText, path: filePath });
  if (file.outcome === "failed") {
    return file;
  }
  return selectionFrom({ ...request, ruleSetFiles: createRuleSetFiles(request), file: file.value, filePath });
};
