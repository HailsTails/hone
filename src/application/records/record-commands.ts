import type {
  AttributedCheckException,
  CheckFinding,
  NamedGovernedRun,
} from "../../domain/finding/governance.ts";
import type { SymptomCatalogue } from "../../domain/language-layer/symptom-catalogue.ts";
import { type DebtOutcome, debtOutcomesOf } from "../../domain/records/debt/debt-effects.ts";
import { debtSitesOf, inSiteOrder } from "../../domain/records/debt/debt-sites.ts";
import { nativeDebtSitesOf } from "../../domain/records/debt/native-debt-sites.ts";
import { type PrunableDebt, prunableDebtOf } from "../../domain/records/debt/prunable-debt.ts";
import type { HoneRecordsFailure } from "../../domain/records/hone-records-failure.ts";
import type {
  RecordsAtBase,
  RecordsDocument,
  RecordsReading,
} from "../../domain/records/hone-records/hone-record.ts";
import type { RecordAddition } from "../../domain/records/hone-records/records-edit.ts";
import { namedRecordsFileOf } from "../../domain/records/hone-records/records-layout.ts";
import { symptomNameOf } from "../../domain/records/record-address.ts";
import type { RunReport } from "../../domain/report/run-report.ts";
import type { BaseRevisionAvailability } from "../../domain/repository/base-revision-availability.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import type { TouchedSet } from "../../domain/repository/touched-set.ts";
import type { Result } from "../../domain/result.ts";
import type { AuthoriseRequest, Authorising } from "../ports/authorising.ts";
import type { RecordsEditor } from "../ports/records/records-editor.ts";
import type { RecordsReader } from "../ports/records/records-reader.ts";
import type { RecordsSource } from "../ports/records/records-source.ts";
import type { RecordsStore, RecordsUnwritable } from "../ports/records/records-store.ts";
import { type AuthorisingPorts, authorisingOf } from "./authorising.ts";

export type RecordCommandFailure =
  | HoneRecordsFailure
  | RecordsUnwritable
  | { readonly kind: "git-failed"; readonly detail: string };

export type RecordDebtPorts = {
  readonly catalogue: SymptomCatalogue;
  readonly source: Pick<RecordsSource, "read">;
  readonly store: RecordsStore;
  readonly recordsReader: RecordsReader;
  readonly recordsEditor: Pick<RecordsEditor, "documentsWithAdded">;
};

export type RecordDebtRequest = {
  readonly findings: readonly CheckFinding[];
  readonly unrecorded: readonly AttributedCheckException[];
  readonly runs: readonly NamedGovernedRun[];
  readonly touched: TouchedSet;
  readonly leave: readonly RepoPath[];
};

export type PruneDebtPorts = {
  readonly source: Pick<RecordsSource, "read">;
  readonly store: RecordsStore;
  readonly recordsEditor: Pick<RecordsEditor, "documentsWithRemoved">;
};

export type AuthorisePorts = AuthorisingPorts & {
  readonly catalogue: SymptomCatalogue;
  readonly source: Pick<RecordsSource, "read">;
  readonly store: RecordsStore;
};

type Commanded<Value> = Result<Value, RecordCommandFailure>;

const UNMEASURED_BASE: RecordsAtBase = { measured: "no", base: { state: "not-given" } };

const documentsOf = (request: {
  readonly source: Pick<RecordsSource, "read">;
}): Commanded<readonly RecordsDocument[]> => {
  const read = request.source.read();
  return read.outcome === "failed"
    ? { outcome: "failed", error: { kind: "records-folder", failure: read.error } }
    : read;
};

const unmeasuredFailure = (request: {
  readonly base: BaseRevisionAvailability;
}): Commanded<never> => ({
  outcome: "failed",
  error: {
    kind: "git-failed",
    detail:
      request.base.state === "git-failed" ? request.base.gitMessage : "no base revision was given",
  },
});

const heldDebtOf = (request: {
  readonly ports: RecordDebtPorts;
  readonly documents: readonly RecordsDocument[];
}): Commanded<RecordsReading> => {
  const reading = request.ports.recordsReader.recordsReadingOf({
    documents: request.documents,
    catalogue: request.ports.catalogue,
    base: UNMEASURED_BASE,
  });
  return reading.outcome === "failed"
    ? { outcome: "failed", error: { kind: "records-documents", refusals: reading.error } }
    : reading;
};

const additionOf = (request: {
  readonly outcome: Extract<DebtOutcome, { readonly effect: "recorded" }>;
}): Commanded<readonly RecordAddition[]> => {
  const { ruleSet } = request.outcome;
  const file = namedRecordsFileOf({
    ruleSet,
    kind: "debt",
    name: symptomNameOf({ address: request.outcome.address }),
  });
  return file.outcome === "failed"
    ? {
        outcome: "failed",
        error: { kind: "records-folder", failure: file.error },
      }
    : {
        outcome: "ok",
        value: [
          {
            file: file.value,
            entry: { answers: request.outcome.address, file: request.outcome.file },
          },
        ],
      };
};

const additionsOf = (request: {
  readonly outcomes: readonly DebtOutcome[];
}): Commanded<readonly RecordAddition[]> => {
  const additions = request.outcomes.flatMap((outcome) =>
    outcome.effect === "recorded" ? [additionOf({ outcome })] : [],
  );
  const failed = additions.find((addition) => addition.outcome === "failed");
  return (
    failed ?? {
      outcome: "ok",
      value: additions.flatMap((addition) => (addition.outcome === "ok" ? addition.value : [])),
    }
  );
};

const storedAdditions = (request: {
  readonly ports: Pick<RecordDebtPorts, "store" | "recordsEditor">;
  readonly documents: readonly RecordsDocument[];
  readonly additions: readonly RecordAddition[];
}): Commanded<void> => {
  if (request.additions.length === 0) {
    return { outcome: "ok", value: undefined };
  }
  const added = request.ports.recordsEditor.documentsWithAdded(request);
  return added.outcome === "failed"
    ? added
    : request.ports.store.apply({ edit: { write: added.value, remove: [] } });
};

const outcomesOf = (request: {
  readonly ports: RecordDebtPorts;
  readonly run: RecordDebtRequest;
  readonly documents: readonly RecordsDocument[];
}): Commanded<readonly DebtOutcome[]> => {
  const held = heldDebtOf(request);
  if (held.outcome === "failed") {
    return held;
  }
  const { touched } = request.run;
  if (touched.measured === "no") {
    return unmeasuredFailure({ base: touched.base });
  }
  const { catalogue } = request.ports;
  const natives = nativeDebtSitesOf({
    catalogue,
    unrecorded: request.run.unrecorded,
    runs: request.run.runs,
  });
  const findings = debtSitesOf({
    catalogue,
    findings: request.run.findings,
    runs: request.run.runs,
  });
  return {
    outcome: "ok",
    value: debtOutcomesOf({
      sites: inSiteOrder({ sites: [...natives.recordable, ...findings.recordable] }),
      unrecordable: [...findings.unrecordable, ...natives.unrecordable],
      records: held.value.records,
      leave: request.run.leave,
      touched,
    }),
  };
};

export const recordDebtOf = (request: {
  readonly ports: RecordDebtPorts;
  readonly run: RecordDebtRequest;
}): Commanded<readonly DebtOutcome[]> => {
  const { ports, run } = request;
  if (run.findings.length === 0 && run.unrecorded.length === 0) {
    return { outcome: "ok", value: [] };
  }
  const documents = documentsOf(ports);
  if (documents.outcome === "failed") {
    return documents;
  }
  const outcomes = outcomesOf({ ports, run, documents: documents.value });
  if (outcomes.outcome === "failed") {
    return outcomes;
  }
  const additions = additionsOf({ outcomes: outcomes.value });
  if (additions.outcome === "failed") {
    return additions;
  }
  const stored = storedAdditions({ ports, documents: documents.value, additions: additions.value });
  return stored.outcome === "failed" ? stored : outcomes;
};

export const pruneDebtOf = (request: {
  readonly ports: PruneDebtPorts;
  readonly report: Pick<RunReport, "paid" | "stale" | "forfeited">;
}): Commanded<readonly PrunableDebt[]> => {
  const { ports } = request;
  const prunable = prunableDebtOf(request);
  if (prunable.length === 0) {
    return { outcome: "ok", value: [] };
  }
  const documents = documentsOf(ports);
  if (documents.outcome === "failed") {
    return documents;
  }
  const edit = ports.recordsEditor.documentsWithRemoved({
    documents: documents.value,
    places: prunable.map((pruned) => pruned.place),
  });
  if (edit.outcome === "failed") {
    return edit;
  }
  const stored = ports.store.apply({ edit: edit.value });
  return stored.outcome === "failed" ? stored : { outcome: "ok", value: prunable };
};

export const authoriseOf = (command: {
  readonly ports: AuthorisePorts;
  readonly request: AuthoriseRequest;
}): Commanded<Authorising> => {
  const { ports, request } = command;
  const documents = documentsOf(ports);
  if (documents.outcome === "failed") {
    return documents;
  }
  const authorising = authorisingOf({
    recordsReader: ports.recordsReader,
    recordsEditor: ports.recordsEditor,
    request,
    documents: documents.value,
    catalogue: ports.catalogue,
  });
  if (authorising.outcome === "failed" || authorising.value.judged !== "accepted") {
    return authorising;
  }
  const stored = ports.store.apply({ edit: authorising.value.edit });
  return stored.outcome === "failed" ? stored : authorising;
};
