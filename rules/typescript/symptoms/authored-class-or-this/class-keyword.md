# class-keyword

```json
{
  "misses": "`this` outside a class.",
  "settingsTracedTo": "none."
}
```

A class declaration or expression outside ambient code.

## Flags
- TypeScript source files; declaration files (`.d.ts`) are skipped. Generated folders (`node_modules`, `dist`, `build`, `coverage`, `.git`, root `vendor`) are skipped by the walker. The ESLint piece lints whatever files the team's ESLint run includes.
- Any class declaration, class expression, `abstract class`, nested class, or class inside a runtime `namespace`, reported at the `class` keyword.
- Allowed: `declare class`, classes inside `declare module`, `declare global` or `declare namespace`, and `new Client()` on a class imported from a library.
- Other generated code can be left out of the walker's scope with `exclude` in `hone.config.json`. Hand-written classes are not out of scope.

## Example
```ts
export class Counter {}
```

## Fix
```ts
export const createCounter = () => {
  let count = 0;
  return { increment: () => (count += 1) };
};
```
Return an object of functions from a factory that closes over its state.
