import { z } from "zod";

import type { FileTextPort } from "../../src/application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../src/application/ports/host/path-port.ts";
import { TOOL_IDENTITY } from "../../src/domain/rule-set/tool-identity.ts";
import { parsedJson } from "../../src/infrastructure/content-files/parsed-json.ts";
import type { InstalledCommandPort } from "./installed-command-port.ts";

const installedManifestSchema = z.object({
  bin: z.object({ [TOOL_IDENTITY.command]: z.string().min(1) }),
});

export const createInstalledCommandPort = (options: {
  readonly path: PathPort;
  readonly fileText: Pick<FileTextPort, "read">;
}): InstalledCommandPort => ({
  read: (request) => {
    const text = options.fileText.read({ path: request.manifest });
    if (text.outcome === "failed") {
      return {
        outcome: "failed",
        error: { kind: "installed-manifest-unread", detail: text.error.detail },
      };
    }
    const parsed = parsedJson({ text: text.value });
    const declared = installedManifestSchema.safeParse(
      parsed.outcome === "ok" ? parsed.value : undefined,
    );
    if (!declared.success) {
      return {
        outcome: "failed",
        error: { kind: "installed-command-unnamed", manifest: request.manifest },
      };
    }
    const location = options.path.join({
      segments: [
        options.path.directoryOf({ path: request.manifest }),
        declared.data.bin[TOOL_IDENTITY.command],
      ],
    });
    const resolved = options.path.resolve({ path: location });
    return resolved.outcome === "failed"
      ? { outcome: "failed", error: { kind: "installed-command-unresolved", path: location } }
      : resolved;
  },
});
