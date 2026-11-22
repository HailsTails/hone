# clock-sources

```json
{
  "flagsBeyondTheSymptom": "`Date.now` in comments and strings.",
  "misses": "`performance.now()`.",
  "settingsTracedTo": "none."
}
```

`Date.now()` and `new Date`.

## Flags

- `.ts` and `.tsx` files, including tests. Generated folders (`node_modules`, `dist`, `build`, `coverage`, `.git`, root `vendor`) are skipped.
- Any line containing `Date.now()` or `new Date`, one finding per line. Comments and strings are matched too.
- Other time sources (`performance.now`, timers) are not checked; they are left to review.
- Other generated code can be left out of the check's scope with `exclude` in disciplines.json. Hand-written code that reads the time is not out of scope; it needs the clock port.

## Example

```ts
const startedAt = Date.now();
```

## Fix

```ts
const startedAt = clock.now();
```
Accept a clock as a dependency and read time only through it. The one real implementation lives in an adapter.
