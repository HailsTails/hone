# identifier-names

```json
{}
```

A binding named from a fixed shorthand or filler list.

- **Misses:** shorthand not on the list.
- **Settings traced to:** shorthand and filler list: Whole words recipe.

## Flags
- `.ts` and `.tsx` files, including tests; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- The declared name of a variable, a parameter, a named function declaration or a destructured binding, when the whole name is exactly one of these (case-sensitive):
  - shorthand: `c op s cb fn tx e ev acc item k v el arr i j n obj val res req tmp temp`
  - filler: `object obj args arguments details extra extras data info params parameters props payload body value result stuff things misc metadata`
- Allowed: longer names that contain these words (`accountData`), names starting with `_`, property keys and property accesses.
- Other poor names (`manager`, `handler`, vague nouns) are left to review.

## Example
```ts
const data = await loadAccount(id);
```

## Fix
```ts
const account = await loadAccount(id);
```
Name the value for what it is in the domain.
