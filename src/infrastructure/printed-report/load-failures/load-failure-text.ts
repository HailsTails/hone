import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import { versionOneEngineNameOf } from "../../../domain/rule-set/engine-id.ts";
import { TOOL_IDENTITY } from "../../../domain/rule-set/tool-identity.ts";
import type {
  RunnerFailure,
  UnavailablePeer,
  UnavailablePeers,
} from "../../../domain/runner/runner-failure.ts";
import { NOT_INSTALLED } from "../../engines/protocol/toolchain/toolchain-requirement.ts";

const escapedLineBreaks = (request: { readonly text: string }): string =>
  request.text.replaceAll("\n", "\\n").replaceAll("\r", "\\r");

const JUDGEMENT_CLAUSE_LISTED_REPAIR =
  "a judgement clause is enforced by review and is left out of clauses, adopted or not; remove it";

const CONFIG_ROOT_REPAIR =
  "an eslintConfigRoots entry is a folder git tracks files under outside every excluded path, spelled exactly as git spells it; fix or remove it in disciplines.json";

const SELECTION_ABSENT_REPAIR =
  "holds no disciplines.json; give the folder that holds it, usually the repository root";

const WHY_CHAINS_REQUIRED_REPAIR = `${TOOL_IDENTITY.command} record-debt writes records that give only a reason, and this file requires a whyChain on every record; set "fileExceptionWhyChains": "optional" in it to accept them`;

const BOTH_LAYOUTS_REPAIR = `${TOOL_IDENTITY.name} reads exception records from one layout; keep each record in one of them and remove the other`;

const SUPPORTED_VERSION_REPAIR =
  "add a supported version to the devDependencies of the repository root";

const EACH_SUPPORTED_VERSION_REPAIR =
  "add a supported version of each to the devDependencies of the repository root";

const unavailablePeerRepair = (request: { readonly peer: UnavailablePeer }): string =>
  request.peer.peer === "required" && request.peer.found === NOT_INSTALLED
    ? `${request.peer.packageName} is a required peer of ${TOOL_IDENTITY.packageName}, so this install is incomplete; ${SUPPORTED_VERSION_REPAIR} and reinstall`
    : SUPPORTED_VERSION_REPAIR;

const unavailablePeersRepair = (request: { readonly peers: UnavailablePeers }): string => {
  const [first, ...rest] = request.peers;
  return rest.length === 0 ? unavailablePeerRepair({ peer: first }) : EACH_SUPPORTED_VERSION_REPAIR;
};

const unavailablePeerText = (request: { readonly peer: UnavailablePeer }): string =>
  `${request.peer.packageName} found ${request.peer.found}, supported ${request.peer.supported}`;

const runnerFailureFields = (request: { readonly failure: RunnerFailure }): readonly string[] => {
  switch (request.failure.kind) {
    case "piece-invalid":
      return [request.failure.kind, request.failure.pieceRoot, request.failure.detail];
    case "file-unreadable":
    case "file-unparseable":
      return [request.failure.kind, request.failure.file, request.failure.detail];
    case "toolchain-unavailable":
      return [
        request.failure.kind,
        `${request.failure.peers.map((peer) => unavailablePeerText({ peer })).join("; ")}: ${unavailablePeersRepair({ peers: request.failure.peers })}`,
      ];
    case "toolchain-shadowed":
      return [
        request.failure.kind,
        request.failure.packageName,
        `resolved from ${request.failure.location} inside the core install ${request.failure.installRoot}: delete ${request.failure.installRoot}/node_modules, then reinstall the package with the repository's package manager, so the repository's own copy is used`,
      ];
    case "tool-failed":
    case "plugin-conflict":
    case "team-config-unloadable":
    case "runner-invalid-output":
      return [request.failure.kind, request.failure.detail];
  }
};

const loadFailureFields = (request: { readonly failure: LoadFailure }): readonly string[] => {
  switch (request.failure.kind) {
    case "arguments-invalid":
    case "git-failed":
    case "unexpected-error":
      return [request.failure.detail];
    case "selection-absent":
      return [request.failure.repo, SELECTION_ABSENT_REPAIR];
    case "install-root-unresolvable":
      return [request.failure.url, request.failure.detail];
    case "file-unreadable":
    case "file-malformed":
    case "file-unwritable":
    case "records-unsplittable":
    case "rule-set-invalid":
      return [request.failure.path, request.failure.detail];
    case "rule-set-not-upgraded":
      return [request.failure.path];
    case "rule-set-half-upgraded":
      return [request.failure.path, ...request.failure.files];
    case "records-in-both-layouts":
      return [request.failure.path, `${request.failure.folder}:`, BOTH_LAYOUTS_REPAIR];
    case "why-chains-required":
      return [`${request.failure.path}:`, WHY_CHAINS_REQUIRED_REPAIR];
    case "unsupported-version":
      return [request.failure.path, String(JSON.stringify(request.failure.found))];
    case "reserved-rule-set-name":
    case "unknown-rule-set":
      return [request.failure.name];
    case "duplicate-clause":
      return [request.failure.address, request.failure.prefixedAddress];
    case "rule-set-name-collision":
      return [request.failure.name, request.failure.other];
    case "rule-sets-share-a-check":
      return [request.failure.check, ...request.failure.ruleSets];
    case "unknown-discipline":
    case "unknown-clause":
    case "judgement-clause-selected":
      return [request.failure.address];
    case "judgement-clause-listed":
      return [`${request.failure.address}:`, JUDGEMENT_CLAUSE_LISTED_REPAIR];
    case "mechanism-not-allowed":
    case "piece-missing":
      return [request.failure.address, versionOneEngineNameOf(request.failure.mechanism)];
    case "config-root-untracked":
      return [`${request.failure.root}:`, CONFIG_ROOT_REPAIR];
    case "runner-missing":
      return [versionOneEngineNameOf(request.failure.mechanism)];
    case "runner-invalid":
      return [versionOneEngineNameOf(request.failure.mechanism), request.failure.detail];
    case "runner-failed":
      return [
        versionOneEngineNameOf(request.failure.mechanism),
        ...runnerFailureFields({ failure: request.failure.failure }),
      ];
  }
};

export const loadFailureDetail = (request: { readonly failure: LoadFailure }): string =>
  [request.failure.kind, ...loadFailureFields(request)]
    .map((text) => escapedLineBreaks({ text }))
    .join(" ");

export const loadFailureText = (request: { readonly failure: LoadFailure }): string =>
  `load failure: ${loadFailureDetail(request)}\n`;
