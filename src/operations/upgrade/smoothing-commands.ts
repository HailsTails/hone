import type { RecordsEditor } from "../../application/ports/records/records-editor.ts";
import type { RecordsReader } from "../../application/ports/records/records-reader.ts";
import type { RecordsStore } from "../../application/ports/records/records-store.ts";
import type {
  SmoothingChanges,
  SmoothingCommands,
  SmoothingFailure,
  SmoothingWritten,
} from "../../application/ports/upgrade/smoothing-commands.ts";
import { versionTwoProjectionOver } from "../../application/projection/version-two-projection.ts";
import { type VersionTwoStages, versionTwoRunOver } from "../../application/run/version-two-run.ts";
import { type RecordsEdit, recordsTextOf } from "../../domain/records/hone-records/records-edit.ts";
import { mapStaleRecordsToWrittenCarried } from "../../domain/records/upgrade/written-carried-stale.ts";
import { runLoadFailureOf, type RunLoadFailure } from "../../domain/report/run-load-failure.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../domain/result.ts";
import {
  type RecordsSourceFor,
  type VersionTwoRecordInput,
  versionTwoPruneDebtOf,
  versionTwoRecordDebtOf,
} from "../version-two-record-commands.ts";

export type FoundTreeReach = {
  readonly stages: VersionTwoStages;
  readonly recordsSourceFor: RecordsSourceFor;
};

export type SmoothingCommandsRequest = {
  readonly reach: (request: SmoothingWritten) => FoundTreeReach;
  readonly repoRoot: AbsolutePath;
  readonly recordsReader: RecordsReader;
  readonly recordsEditor: RecordsEditor;
  readonly projectCommand: string;
};

type CapturingStore = {
  readonly store: RecordsStore;
  readonly edits: () => readonly RecordsEdit[];
};

const NO_CHANGES: SmoothingChanges = { write: [], remove: [] };

const createCapturingStore = (): CapturingStore => {
  const edits: RecordsEdit[] = [];
  return {
    store: {
      apply: ({ edit }) => {
        edits.push(edit);
        return { outcome: "ok", value: undefined };
      },
    },
    edits: () => edits,
  };
};

const mapEditsToChanges = (request: {
  readonly edits: readonly RecordsEdit[];
}): SmoothingChanges => ({
  write: request.edits.flatMap(({ write }) =>
    write.map(({ file, document }) => ({ file, text: recordsTextOf({ document }) })),
  ),
  remove: request.edits.flatMap(({ remove }) => remove),
});

const runFailed = (request: {
  readonly failure: RunLoadFailure;
}): Result<never, SmoothingFailure> => ({
  outcome: "failed",
  error: { kind: "run-failed", failure: request.failure },
});

const createRecordInput = (
  request: SmoothingCommandsRequest & {
    readonly proofWritten: SmoothingWritten;
    readonly store: RecordsStore;
  },
): VersionTwoRecordInput => {
  const reach = request.reach(request.proofWritten);
  return {
    stages: reach.stages,
    repoRoot: request.repoRoot,
    recordsSourceFor: reach.recordsSourceFor,
    recordsStoreOf: () => request.store,
    recordsReader: request.recordsReader,
    recordsEditor: request.recordsEditor,
  };
};

const runProject = async (
  request: SmoothingCommandsRequest & { readonly proofWritten: SmoothingWritten },
): Promise<Result<SmoothingChanges, SmoothingFailure>> => {
  const projected = await versionTwoProjectionOver({
    stages: request.reach(request.proofWritten).stages,
  });
  return projected.outcome === "failed"
    ? runFailed({ failure: projected.error })
    : {
        outcome: "ok",
        value: {
          write: projected.value.flatMap((entry) =>
            entry.kind === "write" ? [{ file: entry.file, text: entry.text }] : [],
          ),
          remove: projected.value.flatMap((entry) => (entry.kind === "remove" ? [entry.file] : [])),
        },
      };
};

const runRemoveCarried = async (
  request: SmoothingCommandsRequest & { readonly proofWritten: SmoothingWritten },
): ReturnType<SmoothingCommands["removeCarried"]> => {
  const reach = request.reach(request.proofWritten);
  const run = await versionTwoRunOver({
    stages: reach.stages,
    arguments: { forfeiture: undefined, reportOutput: undefined, measuring: "always" },
  });
  if (run.outcome === "failed") return runFailed({ failure: run.error });
  const { report, catalogue } = run.value;
  if (report.unmeasured.length > 0) {
    return { outcome: "failed", error: { kind: "run-unmeasured", unmeasured: report.unmeasured } };
  }
  const carried = mapStaleRecordsToWrittenCarried({
    stale: report.stale,
    written: request.proofWritten.written,
  });
  if (carried.length === 0) {
    return { outcome: "ok", value: { changes: NO_CHANGES, done: [] } };
  }
  const documents = reach.recordsSourceFor({ catalogue }).read();
  if (documents.outcome === "failed") {
    return runFailed({
      failure: runLoadFailureOf({
        engines: [],
        source: { kind: "records-folder", failure: documents.error },
      }),
    });
  }
  const edit = request.recordsEditor.documentsWithRemoved({
    documents: documents.value,
    places: carried.map(({ place }) => place),
  });
  return edit.outcome === "failed"
    ? runFailed({ failure: runLoadFailureOf({ engines: [], source: edit.error }) })
    : {
        outcome: "ok",
        value: { changes: mapEditsToChanges({ edits: [edit.value] }), done: carried },
      };
};

const runRecordDebt = async (
  request: SmoothingCommandsRequest & { readonly proofWritten: SmoothingWritten },
): ReturnType<SmoothingCommands["recordDebt"]> => {
  const capturing = createCapturingStore();
  const recorded = await versionTwoRecordDebtOf({
    ...createRecordInput({ ...request, store: capturing.store }),
    leave: [],
    projectCommand: request.projectCommand,
  });
  return recorded.outcome === "failed"
    ? runFailed({ failure: recorded.error })
    : {
        outcome: "ok",
        value: {
          changes: mapEditsToChanges({ edits: capturing.edits() }),
          done: recorded.value.outcomes,
        },
      };
};

const runPruneDebt = async (
  request: SmoothingCommandsRequest & { readonly proofWritten: SmoothingWritten },
): ReturnType<SmoothingCommands["pruneDebt"]> => {
  const capturing = createCapturingStore();
  const pruned = await versionTwoPruneDebtOf({
    ...createRecordInput({ ...request, store: capturing.store }),
    forfeiture: undefined,
    projectCommand: request.projectCommand,
  });
  return pruned.outcome === "failed"
    ? runFailed({ failure: pruned.error })
    : {
        outcome: "ok",
        value: { changes: mapEditsToChanges({ edits: capturing.edits() }), done: pruned.value },
      };
};

export const createSmoothingCommands = (request: SmoothingCommandsRequest): SmoothingCommands => ({
  project: (proofWritten) => runProject({ ...request, proofWritten }),
  removeCarried: (proofWritten) => runRemoveCarried({ ...request, proofWritten }),
  recordDebt: (proofWritten) => runRecordDebt({ ...request, proofWritten }),
  pruneDebt: (proofWritten) => runPruneDebt({ ...request, proofWritten }),
});
