import type { AuthoriseRequest } from "../../../application/ports/authorising.ts";
import type { Why } from "../../../domain/records/why-chain.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import { type OwnedName, ownedNameOf } from "../../../domain/rule-set/rule-set-identity.ts";
import { repoPathSchema } from "../../hone-records-folder/repo-path.ts";

export type AuthoriseOptionName =
  | "repo"
  | "answers"
  | "file"
  | "case"
  | "owes"
  | "why"
  | "because"
  | "evidence"
  | "rootCause"
  | "rootEvidence"
  | "readback"
  | "owner";

export const AUTHORISE_OPTIONS: Readonly<Record<AuthoriseOptionName, string>> = {
  repo: "--repo",
  answers: "--answers",
  file: "--file",
  case: "--case",
  owes: "--owes",
  why: "--why",
  because: "--because",
  evidence: "--evidence",
  rootCause: "--root-cause",
  rootEvidence: "--root-evidence",
  readback: "--readback",
  owner: "--owner",
};

export type AuthoriseArgumentsInvalid = {
  readonly kind: "arguments-invalid";
  readonly detail: string;
};

export type OptionValues = ReadonlyMap<string, readonly string[]>;

type Read<Value> = Result<Value, AuthoriseArgumentsInvalid>;

type Reading = { readonly values: OptionValues };

const COMMAND = "hone authorise";

const invalid = (request: { readonly detail: string }): Read<never> => ({
  outcome: "failed",
  error: { kind: "arguments-invalid", detail: `${COMMAND} ${request.detail}` },
});

const onceOf = (request: Reading & { readonly option: AuthoriseOptionName }): Read<string> => {
  const name = AUTHORISE_OPTIONS[request.option];
  const [only, ...rest] = request.values.get(name) ?? [];
  if (only === undefined) {
    return invalid({ detail: `needs ${name}` });
  }
  return rest.length > 0
    ? invalid({ detail: `takes ${name} once` })
    : { outcome: "ok", value: only };
};

const whysOf = (request: Reading): Read<readonly Why[]> => {
  const questions = request.values.get(AUTHORISE_OPTIONS.why) ?? [];
  const answers = request.values.get(AUTHORISE_OPTIONS.because) ?? [];
  const evidence = request.values.get(AUTHORISE_OPTIONS.evidence) ?? [];
  const whys = questions.flatMap((why, position) => {
    const because = answers[position];
    const proof = evidence[position];
    return because === undefined || proof === undefined ? [] : [{ why, because, evidence: proof }];
  });
  if (
    whys.length !== questions.length ||
    answers.length !== questions.length ||
    evidence.length !== questions.length
  ) {
    return invalid({
      detail: `needs ${AUTHORISE_OPTIONS.why}, ${AUTHORISE_OPTIONS.because} and ${AUTHORISE_OPTIONS.evidence} the same number of times, one of each for every why`,
    });
  }
  return { outcome: "ok", value: whys };
};

const fileOf = (request: Reading): Read<RepoPath> => {
  const given = onceOf({ ...request, option: "file" });
  if (given.outcome === "failed") {
    return given;
  }
  const file = repoPathSchema.safeParse(given.value);
  return file.success
    ? { outcome: "ok", value: file.data }
    : invalid({
        detail: `takes one file inside the repository, written relative to it, for ${AUTHORISE_OPTIONS.file}, not ${JSON.stringify(given.value)}`,
      });
};

type Site = Pick<AuthoriseRequest, "answers" | "case" | "owes" | "owner">;

type Root = Pick<AuthoriseRequest, "rootCause" | "rootEvidence" | "readback">;

const answersOf = (request: Reading): Read<OwnedName> => {
  const given = onceOf({ ...request, option: "answers" });
  if (given.outcome === "failed") {
    return given;
  }
  const owned = ownedNameOf({ text: given.value });
  return owned === "not-an-owned-name"
    ? invalid({
        detail: `takes a symptom or check address for ${AUTHORISE_OPTIONS.answers}, after its rule set and a slash when a team's rule set holds it, not ${JSON.stringify(given.value)}`,
      })
    : { outcome: "ok", value: owned };
};

const siteOf = (request: Reading): Read<Site> => {
  const answers = answersOf(request);
  const caseName = onceOf({ ...request, option: "case" });
  const owes = onceOf({ ...request, option: "owes" });
  const owner = onceOf({ ...request, option: "owner" });
  if (answers.outcome === "failed") {
    return answers;
  }
  if (caseName.outcome === "failed") {
    return caseName;
  }
  if (owes.outcome === "failed") {
    return owes;
  }
  return owner.outcome === "failed"
    ? owner
    : {
        outcome: "ok",
        value: {
          answers: answers.value,
          case: caseName.value,
          owes: owes.value,
          owner: owner.value,
        },
      };
};

const rootOf = (request: Reading): Read<Root> => {
  const rootCause = onceOf({ ...request, option: "rootCause" });
  const rootEvidence = onceOf({ ...request, option: "rootEvidence" });
  const readback = onceOf({ ...request, option: "readback" });
  if (rootCause.outcome === "failed") {
    return rootCause;
  }
  if (rootEvidence.outcome === "failed") {
    return rootEvidence;
  }
  return readback.outcome === "failed"
    ? readback
    : {
        outcome: "ok",
        value: {
          rootCause: rootCause.value,
          rootEvidence: rootEvidence.value,
          readback: readback.value,
        },
      };
};

export const authoriseRequestOf = (request: Reading): Read<AuthoriseRequest> => {
  const site = siteOf(request);
  const file = fileOf(request);
  const root = rootOf(request);
  const whys = whysOf(request);
  if (site.outcome === "failed") {
    return site;
  }
  if (file.outcome === "failed") {
    return file;
  }
  if (root.outcome === "failed") {
    return root;
  }
  return whys.outcome === "failed"
    ? whys
    : {
        outcome: "ok",
        value: { ...site.value, ...root.value, file: file.value, whys: whys.value },
      };
};
