# import-or-require

```json
{
  "findingSpecifics": ["outside-party"],
  "misses": "`import()`, `require`, globals.",
  "settingsTracedTo": "`confinedOutsideDependencies`, empty by default on purpose: the universe of outside dependencies cannot be listed, and flagging every import would catch internal packages. Telling outside from internal needs the workspace layout, which Hone can read."
}
```

Imports of the packages the repository confines, and any `node:` import.

## Flags

- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- A line with `from "<specifier>"` where the specifier is a package listed in the check's `confinedOutsideDependencies` setting (see [Settings](#settings)) or a subpath of one: `hono` covers `hono` and `hono/cors`, and `@scope/name` covers `@scope/name` and `@scope/name/client`. A longer name is a different package, so `hono` does not cover `honox` or `hono-extra`. With no packages listed, which is the default, no library import is flagged. Type-only imports and matches inside strings are flagged too.
- A `node:` specifier in an import, `export ... from`, `import("node:...")`, `import type`, `import x = require(...)` or `require("node:...")`. Unprefixed `fs` is not detected.
- The source rule covers every third-party dependency; the check covers only the listed packages. The rest is left to review.

## Settings

In `hone.config.json`, list each outside dependency the repository confines to its adapter. Record an [authorised location](../../../records.md#authorised-location) for each adapter file and outside party.

```jsonc
"checkSettings": {
  "outside-import-past-a-boundary#import-or-require": { "confinedOutsideDependencies": ["winston", "uuid"] }
}
```

## Example

With `"confinedOutsideDependencies": ["uuid"]`, both lines are flagged; with the default, only the first.

```ts
import { readFileSync } from "node:fs";
import { v4 } from "uuid";
```

## Fix

```ts
import type { FileReader } from "./file-reader.ts";
import type { IdGenerator } from "./id-generator.ts";
```
Import your own port and take it in the unit's argument. Only the adapter for that outside party imports the library.
