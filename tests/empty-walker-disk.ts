import type { EntryKindPort } from "../src/infrastructure/node/file-system/file-system-port.ts";
import { textsDisk } from "../src/infrastructure/engines/audit/runner/pieces/walker-disk.ts";
import type { WalkerDisk } from "../src/infrastructure/engines/audit/runner/pieces/walker-piece.ts";

export const EMPTY_DISK: WalkerDisk = textsDisk({ root: "/repo", texts: {} });

export const ABSENT_ENTRY_KIND: EntryKindPort = { kindOf: () => "absent" };
