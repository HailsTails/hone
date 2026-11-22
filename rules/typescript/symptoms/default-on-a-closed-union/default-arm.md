# default-arm

```json
{
  "flagsBeyondTheSymptom": "a `switch` over an open set.",
  "settingsTracedTo": "none."
}
```

A `default:` arm inside a `switch`.

## Flags
- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- A line matching `default:` while inside a `switch (`, tracked line by line by counting braces. One finding per line; comment lines are ignored.
- Every `default:` is flagged. The check cannot tell whether the switch is over a closed union, so a switch over an open set (a plain string) needs an exception. Other `default:` text inside a switch, such as an object key, is flagged too.

## Example
```ts
switch (event.kind) {
  case "opened": return open();
  default: return ignore();
}
```

## Fix
```ts
switch (event.kind) {
  case "opened": return open();
  case "closed": return ignore();
}
```
Name each remaining variant so the compiler checks exhaustiveness.
