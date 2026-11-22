import { z } from "zod";
import { repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import type { Equal } from "./type-equality.ts";
import type { PeerKind, RunnerFailure } from "../../../../domain/runner/runner-failure.ts";

export const peerKindSchema = z.enum(["required", "optional"]);

const unavailablePeerSchema = z
  .object({ packageName: z.string(), peer: peerKindSchema, supported: z.string(), found: z.string() })
  .readonly();

export const runnerFailureSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("piece-invalid"), pieceRoot: z.string(), detail: z.string() })
    .readonly(),
  z.object({ kind: z.literal("tool-failed"), detail: z.string() }).readonly(),
  z
    .object({ kind: z.literal("file-unreadable"), file: repoPathSchema, detail: z.string() })
    .readonly(),
  z.object({ kind: z.literal("plugin-conflict"), detail: z.string() }).readonly(),
  z.object({ kind: z.literal("team-config-unloadable"), detail: z.string() }).readonly(),
  z.object({ kind: z.literal("runner-invalid-output"), detail: z.string() }).readonly(),
  z
    .object({ kind: z.literal("file-unparseable"), file: repoPathSchema, detail: z.string() })
    .readonly(),
  z
    .object({
      kind: z.literal("toolchain-unavailable"),
      peers: z.tuple([unavailablePeerSchema], unavailablePeerSchema).readonly(),
    })
    .readonly(),
  z
    .object({
      kind: z.literal("toolchain-shadowed"),
      packageName: z.string(),
      location: z.string(),
      installRoot: z.string(),
    })
    .readonly(),
]);

export const isPeerKindSchemaEqual: Equal<z.output<typeof peerKindSchema>, PeerKind> = true;

export const isRunnerFailureSchemaEqual: Equal<z.output<typeof runnerFailureSchema>, RunnerFailure> = true;
