# test-body

```json
{
  "misses": "production sites.",
  "settingsTracedTo": "the edition: backwards compatibility for adopters since the npm release."
}
```

Edition 2: `JSON.stringify` and `JSON.parse` in a test file. These run with the other [test-body checks](../../../README.md#checks-the-test-body-checks), which share their scope, editions and settings.

## Flags
Edition 2:
- `JSON.stringify` and `JSON.parse`. A finding names [Serialising or parsing JSON](#serialising-or-parsing-json).

## Allowed forms in a test

### Serialising or parsing JSON
```ts
declare const render: (row: { readonly id: string }) => string;
expect(JSON.parse(render({ id: "a" }))).toEqual({ id: "a" });
```
A finding on `JSON.stringify` or `JSON.parse` names this section. Assert the object the unit gives back, written out:

```ts
declare const rowOf: (row: { readonly id: string }) => { readonly id: string };
expect(rowOf({ id: "a" })).toEqual({ id: "a" });
```

A unit that gives back only text should hand over an object, leaving the text to the adapter at its edge.
