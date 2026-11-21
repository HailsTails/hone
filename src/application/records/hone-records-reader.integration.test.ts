import { afterAll, assert, describe, expect, it } from "vitest";
import type { Finding } from "../../domain/finding/governance.ts";
import { createDefaultDirectoryPort } from "../../infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../infrastructure/node/file-system/file-text-port.ts";
import type { FileTextPort } from "../ports/file-system/file-text-port.ts";
import { createDefaultGitPort, createDefaultGitTreePort } from "../../infrastructure/git/git-port.ts";
import { createDefaultPathPort } from "../../infrastructure/node/path-port.ts";
import { answerFindings, type RaisedFinding } from "../../domain/records/answering/answering.ts";
import { readHoneRecords } from "./read-hone-records.ts";
import { createRecordsFolder } from "../../infrastructure/hone-records-folder/folder-layout/records-folder.ts";
import { recordsUnmeasuredOf } from "../../domain/records/measurement/records-unmeasured.ts";
import { createSymptomCatalogueRepository } from "../../infrastructure/content-files/symptom-catalogues/read-symptom-catalogue.ts";
import type { TouchedSet } from "../../domain/repository/touched-set.ts";
import { absolutePathSchema } from "../../infrastructure/content-files/absolute-path.ts";
import { clauseAddressSchema } from "../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import type { Recipe } from "../../domain/language-layer/symptom-catalogue.ts";
import type { Result } from "../../domain/result.ts";
import type { ReadonlyJsonValue } from "../../domain/settings/json-values/json-value.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import {
  type CommandRunPort,
  createDefaultCommandRunPort,
  createDefaultScratchFilesPort,
  type ScratchFilesPort,
} from "../../../delivery/install-proof/install-proof-ports.ts";

type ScratchRecordsFile = { readonly folder: string; readonly name: string; readonly records: readonly ReadonlyJsonValue[] };

type RecordsRepository = { readonly base: readonly ScratchRecordsFile[]; readonly working: readonly ScratchRecordsFile[] };

type ScratchPorts = {
  readonly scratch: Pick<ScratchFilesPort, "createTemporaryDirectory" | "makeDirectory">;
  readonly files: Pick<FileTextPort, "write">;
  readonly commands: CommandRunPort;
  readonly path: Pick<PathPort, "join">;
};

type ScratchFailure = { readonly kind: "scratch-failed"; readonly step: string; readonly detail: string };

type Step = Result<null, ScratchFailure>;

const SCRATCH_PREFIX = "hone-records-";

const RECORDS_VERSION = 2;

const JSON_INDENT = 2;

const GIT_IDENTITY: readonly string[] = ["-c", "user.name=hone-records", "-c", "user.email=hone-records@invalid", "-c", "commit.gpgsign=false"];

const DONE: Step = { outcome: "ok", value: null };

const failedAt = (request: { readonly step: string; readonly detail: string }): Result<never, ScratchFailure> => ({
  outcome: "failed",
  error: { kind: "scratch-failed", ...request },
});

const gitRun = (request: { readonly ports: ScratchPorts; readonly root: string; readonly gitArguments: readonly string[] }): Step => {
  const step = `git ${request.gitArguments.join(" ")}`;
  const run = request.ports.commands.run({ command: "git", arguments: request.gitArguments, directory: request.root });
  if (run.outcome === "not-exited") {
    return failedAt({ step, detail: run.detail });
  }
  return run.exitCode === 0 ? DONE : failedAt({ step, detail: run.output });
};

const documentTextOf = (request: { readonly file: ScratchRecordsFile }): string =>
  `${JSON.stringify({ version: RECORDS_VERSION, records: request.file.records }, null, JSON_INDENT)}\n`;

const writtenFile = (request: { readonly ports: ScratchPorts; readonly root: string; readonly file: ScratchRecordsFile }): Step => {
  const folder = request.ports.path.join({ segments: [request.root, request.file.folder] });
  const made = request.ports.scratch.makeDirectory({ path: folder });
  if (made.outcome === "failed") {
    return failedAt({ step: `make ${folder}`, detail: made.error.detail });
  }
  const path = request.ports.path.join({ segments: [request.root, request.file.folder, request.file.name] });
  const written = request.ports.files.write({ path, text: documentTextOf(request) });
  return written.outcome === "failed" ? failedAt({ step: `write ${path}`, detail: written.error.detail }) : DONE;
};

const writtenAll = (request: { readonly ports: ScratchPorts; readonly root: string; readonly files: readonly ScratchRecordsFile[] }): Step =>
  request.files.reduce<Step>((sofar, file) => (sofar.outcome === "failed" ? sofar : writtenFile({ ports: request.ports, root: request.root, file })), DONE);

const recipeReasonIn = (request: { readonly recipes: readonly Recipe[]; readonly recipe: string }): Result<string, ScratchFailure> => {
  const found = request.recipes.find((candidate) => candidate.name === request.recipe);
  return found === undefined
    ? { outcome: "failed", error: { kind: "scratch-failed", step: `find the recipe ${request.recipe}`, detail: "the catalogue holds no such recipe" } }
    : { outcome: "ok", value: found.reason.text };
};

const recordsRepositoryIn = (request: { readonly ports: ScratchPorts; readonly repository: RecordsRepository }): Result<string, ScratchFailure> => {
  const { ports, repository } = request;
  const made = ports.scratch.createTemporaryDirectory({ prefix: SCRATCH_PREFIX });
  if (made.outcome === "failed") {
    return failedAt({ step: "make the temporary directory", detail: made.error.detail });
  }
  const root = made.value;
  const steps: readonly (() => Step)[] = [
    () => gitRun({ ports, root, gitArguments: ["init", "-q"] }),
    () => writtenAll({ ports, root, files: repository.base }),
    () => gitRun({ ports, root, gitArguments: ["add", "-A"] }),
    () => gitRun({ ports, root, gitArguments: [...GIT_IDENTITY, "commit", "-q", "-m", "base"] }),
    () => writtenAll({ ports, root, files: repository.working }),
  ];
  const settled = steps.reduce<Step>((sofar, step) => (sofar.outcome === "failed" ? sofar : step()), DONE);
  return settled.outcome === "failed" ? failedAt(settled.error) : { outcome: "ok", value: root };
};

const fileText = createDefaultFileTextPort({});

const path = createDefaultPathPort({});

const REPO_ROOT = absolutePathSchema.parse(path.join({ segments: [`${import.meta.dirname}/../..`, ".."] }));

const scratch = createDefaultScratchFilesPort({});

const holding = createSymptomCatalogueRepository({ fileText, path, ruleSetRoot: REPO_ROOT }).read({});
assert(holding.outcome === "ok", "the shipped symptom catalogue reads");
assert(holding.value.held === "catalogue", "the shipped symptom catalogue is present");

const { catalogue } = holding.value;

const stubReason = recipeReasonIn({ recipes: catalogue.recipes, recipe: "stub-with-vifn" });
assert(stubReason.outcome === "ok", "the shipped catalogue words the reason for Stub with vi.fn");

const WHY_CHAIN = {
  whys: [
    {
      why: "Why does stripe-webhook.ts cast the parsed event to Stripe.Event?",
      because: "The Stripe SDK hands the webhook handler an untyped payload and its constructEvent returns the event typed only through its own declaration.",
      evidence: "src/adapters/stripe-webhook.ts:12.",
    },
    {
      why: "Why does the Stripe SDK hand the handler an untyped payload?",
      because: "Webhook bodies arrive as raw bytes over HTTP, and the signature check must run over those exact bytes before any parsing.",
      evidence: "https://stripe.com/docs/webhooks/signatures.",
    },
    {
      why: "Why must the signature check run over the raw bytes?",
      because: "Stripe signs the bytes it sent, so any reformatting by a parser would change them and break verification.",
      evidence: "https://stripe.com/docs/webhooks/signatures#verify-manually.",
    },
    {
      why: "Why does Stripe sign the bytes it sent rather than a parsed form?",
      because: "An HMAC over the transmitted body is the only form both ends can reproduce without agreeing a canonical serialisation.",
      evidence: "RFC 2104 defines HMAC over an octet string.",
    },
    {
      why: "Why can both ends reproduce only an HMAC over the transmitted body?",
      because: "JSON has no canonical serialisation, so key order and whitespace differ between producers, and only the octets on the wire are shared.",
      evidence: "RFC 8259 leaves member order and whitespace to the producer.",
    },
  ],
  rootCause: "JSON has no canonical serialisation, so the octets on the wire are the only shared form a signature can cover.",
  rootEvidence: "On 2026-11-20, RFC 8259 still leaves member order and whitespace to the producer.",
  readback:
    "JSON has no canonical serialisation, therefore Stripe signs the raw octets, therefore the SDK hands an untyped payload, therefore stripe-webhook.ts casts the parsed event to Stripe.Event.",
  owner: "owner decision on example/payments#12",
};

const CARRIED_IDS = {
  answers: "outside-import-past-a-boundary",
  file: "src/adapters/ids.ts",
  carried: {
    kind: "authorised-location",
    clause: "CD-19#import-boundaries",
    file: "src/adapters/ids.ts",
    reason: "uuid stays at the ids adapter.",
    provenance: { kind: "existing-authorisation", source: "docs/decisions/0003-ids.md" },
  },
};

const CARRIED_CLOCK_SOURCE = {
  answers: "outside-import-past-a-boundary",
  file: "src/adapters/clock-source.ts",
  carried: {
    kind: "authorised-location",
    clause: "CD-19#import-boundaries",
    file: "src/adapters/clock-source.ts",
    reason: "date-fns stays at the clock source.",
    provenance: { kind: "existing-authorisation", source: "docs/decisions/0004-dates.md" },
  },
};

const REWORDED_CLOCK_SOURCE = { ...CARRIED_CLOCK_SOURCE, carried: { ...CARRIED_CLOCK_SOURCE.carried, reason: "Reworded since the base." } };

const made = recordsRepositoryIn({
  ports: { scratch, files: fileText, commands: createDefaultCommandRunPort({}), path },
  repository: {
    base: [{ folder: "hone-records/authorised-locations", name: "outside-import-past-a-boundary.json", records: [CARRIED_IDS, CARRIED_CLOCK_SOURCE] }],
    working: [
      { folder: "hone-records/authorised-locations", name: "outside-import-past-a-boundary.json", records: [CARRIED_IDS, REWORDED_CLOCK_SOURCE] },
      {
        folder: "hone-records/authorised-locations",
        name: "claimed-type.json",
        records: [{ answers: "claimed-type#unlisted-cast-site", file: "src/adapters/stripe-webhook.ts", case: "gives-a-value-its-type", owes: "declared-not-asserted", whyChain: WHY_CHAIN }],
      },
      { folder: "hone-records/debt", name: "claimed-type.json", records: [{ answers: "claimed-type#unlisted-cast-site", file: "src/adapters/stripe-webhook.ts" }] },
      { folder: "hone-records/debt", name: "text-past-its-reader.json", records: [{ answers: "text-past-its-reader", file: "src/orders/charge-order.test.ts" }] },
      {
        folder: "hone-records/deviations",
        name: "stub-with-vifn.json",
        records: [
          {
            recipe: "stub-with-vifn",
            file: "src/sync/replay.test.ts",
            recipeReason: stubReason.value,
            reasonFails: "The replay is handed a stream whose answers depend on earlier calls.",
            evidence: "src/sync/replay.test.ts:40 calls next() four times.",
            ruleHolds: "Each answer is still written out in the fake's table.",
          },
        ],
      },
      {
        folder: "hone-records",
        name: "boundary-records.json",
        records: [
          { module: "src/adapters/system-clock.ts", outsideParty: "runtime:clock", ports: ["Clock"] },
          { module: "src/adapters/files", outsideParty: "node:fs", ports: ["FileReader"] },
        ],
      },
      { folder: "hone-records", name: "dependency-records.json", records: [{ dependency: "zod", nativeWay: "hand-written parsing at each adapter", whyNotEnough: "Each adapter would repeat its own checks." }] },
    ],
  },
});
assert(made.outcome === "ok", "the scratch repository is made and its base committed");

afterAll(() => {
  scratch.removeTree({ path: made.value });
});

const source = createRecordsFolder({
  fileText,
  path,
  directory: createDefaultDirectoryPort({}),
  git: createDefaultGitPort({}),
  gitTree: createDefaultGitTreePort({}),
  repoRoot: absolutePathSchema.parse(made.value),
});

const AUDIT = mechanismIdSchema.parse("audit");

const findingAt = (request: { readonly clause: string; readonly file: string }): Finding => ({
  clause: clauseAddressSchema.parse(request.clause),
  file: repoPathSchema.parse(request.file),
  anchor: { line: 1, column: 0 },
  snippet: "a site",
  mechanism: AUDIT,
});

const formFindingAt = (request: { readonly clause: string; readonly file: string; readonly section: string }): Finding => ({
  ...findingAt(request),
  remedy: { fix: "Fix it.", page: "CHECKS.md", section: request.section },
});

const CAST_IN_WEBHOOK = findingAt({ clause: "CD-2#cast-expressions", file: "src/adapters/stripe-webhook.ts" });

const CAST_IN_ORDERS = findingAt({ clause: "CD-2#cast-expressions", file: "src/orders/charge-order.ts" });

const JSON_IN_ORDER_TEST = formFindingAt({ clause: "CD-27#test-body-logic", file: "src/orders/charge-order.test.ts", section: "serialising-or-parsing-json" });

const DATE_IN_SYSTEM_CLOCK = findingAt({ clause: "CD-17#clock-sources", file: "src/adapters/system-clock.ts" });

const FS_IMPORT_IN_FILES = findingAt({ clause: "CD-19#import-boundaries", file: "src/adapters/files/read-text.ts" });

const UUID_IMPORT_IN_IDS = findingAt({ clause: "CD-19#import-boundaries", file: "src/adapters/ids.ts" });

const DATE_FNS_IMPORT_IN_CLOCK_SOURCE = findingAt({ clause: "CD-19#import-boundaries", file: "src/adapters/clock-source.ts" });

const FAKE_IN_REPLAY = findingAt({ clause: "CD-25#dependency-isolation", file: "src/sync/replay.test.ts" });

const FINDINGS: readonly RaisedFinding[] = [
  { finding: CAST_IN_WEBHOOK, party: { reported: "not-reported" } },
  { finding: CAST_IN_ORDERS, party: { reported: "not-reported" } },
  { finding: JSON_IN_ORDER_TEST, party: { reported: "not-reported" } },
  { finding: DATE_IN_SYSTEM_CLOCK, party: { reported: "not-reported" } },
  { finding: FS_IMPORT_IN_FILES, party: { reported: "specifier", specifier: "node:fs" } },
  { finding: UUID_IMPORT_IN_IDS, party: { reported: "specifier", specifier: "uuid" } },
  { finding: DATE_FNS_IMPORT_IN_CLOCK_SOURCE, party: { reported: "specifier", specifier: "date-fns" } },
  { finding: FAKE_IN_REPLAY, party: { reported: "not-reported" } },
];

const AUTHORISED_CLAIMED = repoPathSchema.parse("hone-records/authorised-locations/claimed-type.json");

const AUTHORISED_IMPORTS = repoPathSchema.parse("hone-records/authorised-locations/outside-import-past-a-boundary.json");

const BOUNDARIES = repoPathSchema.parse("hone-records/boundary-records.json");

const DEBT = repoPathSchema.parse("hone-records/debt/text-past-its-reader.json");

const DEBT_CLAIMED = repoPathSchema.parse("hone-records/debt/claimed-type.json");

const DEPENDENCIES = repoPathSchema.parse("hone-records/dependency-records.json");

const DEVIATIONS = repoPathSchema.parse("hone-records/deviations/stub-with-vifn.json");

const NOTHING_TOUCHED: TouchedSet = { measured: "yes", paths: new Set() };

describe("Hone's records over a real hone-records folder with a git base, built in the test's own scratch", () => {
  it("reads the plan's record examples, each of its kind in path order, holds the carried record the base holds and refuses the one reworded since", () => {
    expect(readHoneRecords({ source, catalogue, baseRevision: "HEAD" })).toMatchObject({
      outcome: "ok",
      value: {
        records: [
          {
            place: { file: AUTHORISED_CLAIMED, index: 0 },
            record: {
              kind: "authorised-location",
              symptom: { name: "claimed-type" },
              reach: { reaches: "one-check", check: { name: "unlisted-cast-site" } },
              holding: { held: "stated", owing: { matches: "the-catalogue" } },
            },
          },
          { place: { file: AUTHORISED_IMPORTS, index: 0 }, record: { kind: "authorised-location", file: "src/adapters/ids.ts", holding: { held: "carried", standing: "established" } } },
          { place: { file: BOUNDARIES, index: 0 }, record: { kind: "boundary-record", outsideParty: { kind: "runtime", facility: "clock" } } },
          { place: { file: BOUNDARIES, index: 1 }, record: { kind: "boundary-record", outsideParty: { kind: "scheme-module", specifier: "node:fs" } } },
          { place: { file: DEBT_CLAIMED, index: 0 }, record: { kind: "debt", symptom: { name: "claimed-type" }, reach: { reaches: "one-check", check: { name: "unlisted-cast-site" } } } },
          { place: { file: DEBT, index: 0 }, record: { kind: "debt", symptom: { name: "text-past-its-reader" }, reach: { reaches: "whole-symptom" } } },
          { place: { file: DEPENDENCIES, index: 0 }, record: { kind: "dependency-record", dependency: "zod" } },
          { place: { file: DEVIATIONS, index: 0 }, record: { kind: "deviation", recipe: { name: "stub-with-vifn" } } },
        ],
        refused: [{ place: { file: AUTHORISED_IMPORTS, index: 1 }, refusals: [{ kind: "carried-changed-since-base" }] }],
        notes: [],
        base: { measured: "yes" },
      },
    });
  });

  it("answers each finding at an example's site by that record alone, leaves the rest, lists nothing stale, and lists the debt the authorised location holds as paid", () => {
    const reading = readHoneRecords({ source, catalogue, baseRevision: "HEAD" });
    assert(reading.outcome === "ok", "the records read");
    expect(answerFindings({ catalogue, records: reading.value.records, findings: FINDINGS, touched: NOTHING_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } })).toMatchObject({
      findings: [CAST_IN_ORDERS, DATE_FNS_IMPORT_IN_CLOCK_SOURCE],
      answered: [
        { finding: CAST_IN_WEBHOOK, by: [{ place: { file: AUTHORISED_CLAIMED, index: 0 } }] },
        { finding: JSON_IN_ORDER_TEST, by: [{ place: { file: DEBT, index: 0 } }] },
        { finding: DATE_IN_SYSTEM_CLOCK, by: [{ place: { file: BOUNDARIES, index: 0 } }] },
        { finding: FS_IMPORT_IN_FILES, by: [{ place: { file: BOUNDARIES, index: 1 } }] },
        { finding: UUID_IMPORT_IN_IDS, by: [{ place: { file: AUTHORISED_IMPORTS, index: 0 } }] },
        { finding: FAKE_IN_REPLAY, by: [{ place: { file: DEVIATIONS, index: 0 } }] },
      ],
      stale: [],
      forfeited: [],
      paid: [{ debt: { place: { file: DEBT_CLAIMED, index: 0 } }, answeredBy: [{ place: { file: AUTHORISED_CLAIMED, index: 0 } }] }],
      unrecorded: [],
    });
  });

  it("answers by carried records left unjudged when no base revision is given, and lists the import as unmeasured", () => {
    const reading = readHoneRecords({ source, catalogue, baseRevision: undefined });
    assert(reading.outcome === "ok", "the records read");
    expect({
      answering: answerFindings({ catalogue, records: reading.value.records, findings: FINDINGS, touched: NOTHING_TOUCHED, runs: [], measurements: { runs: [], tracked: [], excluded: [] } }),
      unmeasured: recordsUnmeasuredOf({ records: reading.value.records, base: reading.value.base, touched: NOTHING_TOUCHED }),
    }).toMatchObject({
      answering: { findings: [CAST_IN_ORDERS], stale: [] },
      unmeasured: [{ kind: "import-unmeasured", base: { state: "not-given" } }],
    });
  });
});
