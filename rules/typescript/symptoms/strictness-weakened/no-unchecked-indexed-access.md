# no-unchecked-indexed-access

```json
{
  "flagsBeyondTheSymptom": "edition 1: a flag set to `true`.",
  "misses": "edition 1: a base reached by `extends`.",
  "settingsTracedTo": "flag list: The type checker proves it. Edition 1 flags presence, which is the Shared strict base config recipe: **traced to a recipe, not a rule**."
}
```

`noUncheckedIndexedAccess` is set in a `tsconfig.json`; edition 2 adds that it resolves to on.

## Flags
Each strictness-weakened check has two editions. Edition 1 runs by default. Edition 2 also judges what each `tsconfig.json` inherits, and becomes the default in the next major release; see [Settings](#settings) to run it now.

Edition 1:
- `tsconfig.json` files, named exactly, at any depth. `tsconfig.base.json` and other names are not read. Generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- The matching option when it is present in the file's `compilerOptions`. Presence is enough: `true` is flagged as well as `false`.
- Options in `extends`-ed files are not seen. A file that cannot be parsed, or whose root or `compilerOptions` is not an object, fails the run.

Edition 2 also flags, for each selected option a `tsconfig.json` does not set itself, an option its resolved configuration leaves off:
- The configuration is resolved by the repository's installed TypeScript, as `tsc` would resolve it: every file in the `extends` chain, a relative path, a package such as `@tsconfig/strictest` or a workspace package under `node_modules`, and an array of bases on TypeScript 5.0 or later, later bases winning. An option a base turns on and a later file turns off is off.
- `strict` and `useUnknownInCatchVariables` take TypeScript's defaults: TypeScript 6 treats `strict` as on when nothing sets it, and `useUnknownInCatchVariables` follows `strict` unless it is set.
- The finding names the file to edit. `= false, inherited from <base>` names each base that turns the option off. `= false, turned off in <file>` names this `tsconfig.json` when its own `"strict": false` turns `useUnknownInCatchVariables` off. `unset here and in <bases>` lists every file in the chain, none of which sets the option; `unset, and this file extends no base` says there is no chain.
- A configuration TypeScript cannot resolve, such as a base file that is missing, a package that is not installed, or bases that extend each other, is flagged for each selected option the file does not set as `unknown`, followed by TypeScript's own diagnostic. An `extends` holding `${configDir}` resolves however the installed TypeScript resolves it, and is flagged the same way when TypeScript cannot find it. Fix the chain, and the options are judged.
- The base files are judged through the `tsconfig.json` files that extend them, not on their own.
- A `tsconfig.json` from which TypeScript would compile no file is not judged on what it resolves to, since its options apply to no file. After resolving the chain, TypeScript has no `files` entry, and no `include` entry that names a path outright or a folder or pattern it would search. Examples: an empty `files` list, its own or inherited, with no `include`, such as the solution-style root with only `references` that `npm create vite` writes; an empty `include`; an `exclude` of every file. Any non-empty `include` that names a file or a folder is still judged, such as `"include": ["vite.config.ts"]` or `["src"]`, and so is a config that sets neither `files` nor `include`, since TypeScript then includes every file. An option a skipped file sets itself is still flagged, as in edition 1. The configs it references are not judged through it; only files named `tsconfig.json` are read.

## Settings
In `hone.config.json`, set `edition` to `"1"` or `"2"` for this check. Without a pin, the check runs edition 1, or the latest edition when `checkEditions` is `"latest"`.

```jsonc
"checkSettings": {
  "strictness-weakened#no-unchecked-indexed-access": { "edition": "2" }
}
```

## Example
```jsonc
{ "compilerOptions": { "strict": false } }
```

## Fix
```jsonc
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "dist" } }
```
Put the flags in a shared base file that is not named `tsconfig.json`, and leave them out of every `tsconfig.json`. Under edition 1, that the base file turns them on is left to review. Under edition 2 the check reads the base: turn every selected flag on in it.

```jsonc
{ "compilerOptions": { "strict": true, "noUncheckedIndexedAccess": true, "exactOptionalPropertyTypes": true, "noImplicitOverride": true, "noFallthroughCasesInSwitch": true, "noPropertyAccessFromIndexSignature": true, "useUnknownInCatchVariables": true } }
```
