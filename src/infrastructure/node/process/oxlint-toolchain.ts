import { z } from "zod";

import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PackageManifestPort } from "../../../application/ports/host/package-manifest-port.ts";
import type { Result } from "../../../domain/result.ts";
import type { RunnerFailure, UnavailablePeer } from "../../../domain/runner/runner-failure.ts";
import { parsedJson } from "../../content-files/parsed-json.ts";
import { ESLINT_TOOLCHAIN_REQUIREMENTS } from "../../engines/protocol/toolchain/eslint-peer-requirements.ts";
import {
  NOT_INSTALLED,
  supportedRange,
  versionSupport,
  type ToolchainRequirement,
} from "../../engines/protocol/toolchain/toolchain-requirement.ts";
import { createDefaultFileTextPort } from "../file-system/file-text-port.ts";
import { createPackageManifestPort } from "../modules/package-manifest-port.ts";
import { createDefaultPathPort } from "../path-port.ts";

const path = createDefaultPathPort({});
const versionSchema = z.object({ version: z.string() });

const OXLINT_REQUIREMENT: ToolchainRequirement = {
  packageName: "oxlint",
  peer: "optional",
  lines: [{ floor: "1.95.0", below: "2.0.0" }],
};

export const OXLINT_RANGE = supportedRange({ requirement: OXLINT_REQUIREMENT });

const createUnavailable = (requirement: ToolchainRequirement, found: string): UnavailablePeer => ({
  packageName: requirement.packageName,
  peer: requirement.peer,
  supported: supportedRange({ requirement }),
  found,
});

type ManifestPorts = {
  readonly text: Pick<FileTextPort, "read">;
  readonly manifests: PackageManifestPort;
};

const readManifest = (
  request: ManifestPorts & {
    readonly folder: string;
    readonly requirement: ToolchainRequirement;
  },
): Result<string, UnavailablePeer> => {
  const { folder, requirement } = request;
  const manifest = request.manifests.locateManifestFrom({
    folder,
    packageName: requirement.packageName,
  });
  if (manifest.outcome === "failed")
    return { outcome: "failed", error: createUnavailable(requirement, NOT_INSTALLED) };
  const contents = request.text.read({ path: manifest.value });
  if (contents.outcome === "failed")
    return { outcome: "failed", error: createUnavailable(requirement, contents.error.detail) };
  const document = parsedJson({ text: contents.value });
  const version = versionSchema.safeParse(document.outcome === "ok" ? document.value : undefined);
  const found = version.success ? version.data.version : "invalid package manifest";
  return versionSupport({ requirement, version: found }) === "supported"
    ? { outcome: "ok", value: manifest.value }
    : { outcome: "failed", error: createUnavailable(requirement, found) };
};

export const createReadOxlintToolchain =
  (ports: ManifestPorts) =>
  (request: {
    readonly folder: string;
    readonly peerFolders: readonly string[];
  }): Result<string, RunnerFailure> => {
    const oxlint = readManifest({
      ...ports,
      folder: request.folder,
      requirement: OXLINT_REQUIREMENT,
    });
    const peers = [...new Set(request.peerFolders)].flatMap((folder) =>
      ESLINT_TOOLCHAIN_REQUIREMENTS.map((requirement) =>
        readManifest({ ...ports, folder, requirement }),
      ),
    );
    const unavailable = peers.flatMap((peer) => (peer.outcome === "failed" ? [peer.error] : []));
    const [first, ...rest] =
      oxlint.outcome === "failed" ? [oxlint.error, ...unavailable] : unavailable;
    if (first !== undefined)
      return {
        outcome: "failed",
        error: { kind: "toolchain-unavailable", peers: [first, ...rest] },
      };
    return oxlint.outcome === "failed"
      ? { outcome: "failed", error: { kind: "toolchain-unavailable", peers: [oxlint.error] } }
      : {
          outcome: "ok",
          value: path.join({
            segments: [path.directoryOf({ path: oxlint.value }), "bin", "oxlint"],
          }),
        };
  };

export const readOxlintToolchain = createReadOxlintToolchain({
  text: createDefaultFileTextPort({}),
  manifests: createPackageManifestPort({ path }),
});
