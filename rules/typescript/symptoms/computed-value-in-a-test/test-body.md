# test-body

```json
{
  "flagsBeyondTheSymptom": "unit's own API (edition 1).",
  "settingsTracedTo": "the edition: backwards compatibility for adopters since the npm release."
}
```

Computing and mutating string and array methods in a test file; edition 2 adds computing calls on `Object`, `Array` and `Math`. These run with the other [test-body checks](../../../README.md#checks-the-test-body-checks), which share their scope, editions and settings.

## Flags
Edition 1:
- A method call with a computing or mutating name, wherever it could be the string or array method of that name: `map`, `filter`, `reduce`, `find`, `forEach`, `join`, `slice`, `split`, `replace`, `includes`, `sort`, `trim`, `keys`, `values`, `push`, `pop`, `splice`, `fill` and similar string and array methods.
- Not flagged: a call with one of those names whose arguments no string or array method of that name accepts, which makes it the unit's own API. Either it passes an object literal where none of them takes an object, such as `paths.join({ segments: ["a", "b"] })`, or it passes more arguments than any of them takes, such as `screen.keys("x", true, true)`.
- Still flagged, though they look like that:
  - a call whose receiver traces back to a built-in namespace such as `Object` or `Math`, a package or `node:` module (imported, required or loaded with `import()`), or a string or array literal. The trace follows variables declared in the test file, including names destructured from a traced module or namespace, such as `posix` after `const { posix } = path`, and a property read directly off an object literal declared there, such as `deps.path` after `const deps = { path }`;
  - a call that spreads its arguments;
  - an object at a position where a string or array method takes one, such as `rows.includes({ id: "a" })`, `rows.push({ id: "a" })`, `rows.reduce(sum, { total: 0 })`, `rows.find(isA, {})` or `text.split({ [Symbol.split]: splitter })`.
- What this check cannot know: it reads names and syntax, not types, so it cannot tell what a receiver is.
  - It flags the unit's own method given a variable, such as `repository.find(query)`.
  - It misses a string or array method taken off its receiver before the call.
  - It does not trace a receiver that is a function parameter, an `it.each` row, a value from another module (even a relative module that re-exports a package), a name destructured from an object literal, or a property nested deeper in one, such as `deps.nested.path`; it reads these as the unit's own.
  - It releases a method of another built-in or library type that shares a name, such as a stream's `values` or `reduce`, when that call passes an object or more arguments than the string or array method takes.
  Only a check that reads types knows a receiver's identity, and Hone does not have one yet.

Edition 2 also flags:
- Computing calls on a built-in namespace: `Object.assign`, `Object.fromEntries`, `Array.from` and any `Math` method. `JSON.stringify` and `JSON.parse` are [text-past-its-reader#test-body](../text-past-its-reader/test-body.md).

## Allowed forms in a test

### A method that picks or tests an element
```ts
declare const listTasks: () => readonly { readonly id: string; readonly status: "open" | "done" }[];
expect(listTasks().find((task) => task.id === "a")).toEqual({ id: "a", status: "open" });
```
Assert on the whole array:

```ts
declare const listTasks: () => readonly { readonly id: string; readonly status: "open" | "done" }[];
expect(listTasks()).toContainEqual({ id: "a", status: "open" });
```

```ts
declare const listTasks: () => readonly { readonly id: string; readonly status: "open" | "done" }[];
expect(listTasks()).toEqual(expect.arrayContaining([expect.objectContaining({ id: "a" })]));
```

The check cannot tell the unit's own method with one of these names from an array method when it is given a variable, such as `repository.find(query)`. That is a limit of the check, described under [What the check flags](#flags).

### A method that computes a value
```ts
declare const idsOf: (rows: readonly { readonly id: string }[]) => readonly string[];
const rows = [{ id: "a1" }, { id: "b2" }];
expect(idsOf(rows)).toEqual(rows.map((row) => row.id));
```
Write the expected value out:

```ts
declare const idsOf: (rows: readonly { readonly id: string }[]) => readonly string[];
expect(idsOf([{ id: "a1" }, { id: "b2" }])).toEqual(["a1", "b2"]);
```

Or match the part that matters:

```ts
declare const receiptOf: (order: { readonly total: number }) => { readonly total: number; readonly label: string };
expect(receiptOf({ total: 30 })).toMatchObject({ label: expect.stringContaining("30") });
```

### A method that mutates
```ts
declare const namesOf: (team: string) => readonly string[];
const expected = ["Ada"];
expected.push("Grace");
expect(namesOf("core")).toEqual(expected);
```
Write the finished array out:

```ts
declare const namesOf: (team: string) => readonly string[];
expect(namesOf("core")).toEqual(["Ada", "Grace"]);
```

### Merging objects
```ts
const base = { method: "POST", path: "/tasks" } as const;
const request = Object.assign({}, base, { body: "a" });
expect(request.body).toBe("a");
```
Write the object out, spreading what it copies:

```ts
const base = { method: "POST", path: "/tasks" } as const;
const request = { ...base, body: "a" };
expect(request.body).toBe("a");
```

A spread copies an `Error`'s own properties into a plain object, which is not an `Error`. To give an `Error` a property, assign it:

```ts
declare const reasonOf: (error: Error & { readonly code?: string }) => string;
const missing: Error & { code?: string } = new Error("ENOENT");
missing.code = "ENOENT";
expect(reasonOf(missing)).toBe("missing");
```

### Building an object from entries
```ts
declare const countsOf: (words: readonly string[]) => Readonly<Record<string, number>>;
expect(countsOf(["a"])).toEqual(Object.fromEntries([["a", 1]]));
```
Write the object out:

```ts
declare const countsOf: (words: readonly string[]) => Readonly<Record<string, number>>;
expect(countsOf(["a"])).toEqual({ a: 1 });
```

### Building an array from a length
```ts
declare const pageOf: (rows: readonly { readonly id: number }[]) => readonly { readonly id: number }[];
expect(pageOf(Array.from({ length: 3 }, (_, index) => ({ id: index })))).toHaveLength(3);
```
Write a short array out:

```ts
declare const pageOf: (rows: readonly { readonly id: number }[]) => readonly { readonly id: number }[];
expect(pageOf([{ id: 0 }, { id: 1 }, { id: 2 }])).toHaveLength(3);
```

An array too long to read written out, such as one row past a page size of 1,000, has no form on this page.

### A Math call
```ts
declare const roundedOf: (amount: number) => number;
expect(roundedOf(2.5)).toBe(Math.round(2.5));
```
Write the number out:

```ts
declare const roundedOf: (amount: number) => number;
expect(roundedOf(2.5)).toBe(3);
```
