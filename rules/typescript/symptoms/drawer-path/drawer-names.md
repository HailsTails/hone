# drawer-names

```json
{
  "misses": "a drawer under an ordinary name.",
  "settingsTracedTo": "drawer names: Screaming folders recipe."
}
```

A forbidden file name or folder name in a path.

## Flags
- `.ts` and `.tsx` files only, judged by path; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- File names, exactly and in lower case, with a `.ts` extension: `types.ts interfaces.ts models.ts enums.ts utils.ts util.ts helpers.ts helper.ts common.ts lib.ts misc.ts shared.ts`.
- Any folder in the path named `utils`, `helpers`, `common`, `lib`, `misc`, `shared`, `scripts`, `values`, `tests`, `test` or `__tests__`. Each file under such a folder is reported once for the folder.
- Allowed: `account-types.ts`, `Types.ts` and `types.tsx`, which are not exact matches.

## Example
```text
src/helpers.ts
src/utils/format-price.ts
```

## Fix
```text
src/price-formatting.ts
```
Rename the file or folder for what it contains, or split it into files that each hold one thing.
