# Whole written-out expectation

```json
{
  "serves": [
    {
      "rule": "straight-through-tests"
    }
  ],
  "standing": "accepted",
  "reason": {
    "text": "\"no find, use bare access in tests for determinstic insistence on behaviours\".",
    "standing": "accepted"
  },
  "examples": [
    {
      "anchor": "branching-with-if",
      "answers": [
        {
          "check": "branch-in-a-test#test-body",
          "form": "branching-with-if"
        }
      ]
    },
    {
      "anchor": "an-optional-chain-after-an-index",
      "answers": [
        {
          "check": "branch-in-a-test#test-body",
          "form": "an-optional-chain-after-an-index"
        }
      ]
    },
    {
      "anchor": "a-method-that-picks-or-tests-an-element",
      "answers": [
        {
          "check": "computed-value-in-a-test#test-body",
          "form": "a-method-that-picks-or-tests-an-element"
        }
      ]
    },
    {
      "anchor": "a-method-that-computes-a-value",
      "answers": [
        {
          "check": "computed-value-in-a-test#test-body",
          "form": "a-method-that-computes-a-value"
        }
      ]
    },
    {
      "anchor": "a-method-that-mutates",
      "answers": [
        {
          "check": "computed-value-in-a-test#test-body",
          "form": "a-method-that-mutates"
        }
      ]
    },
    {
      "anchor": "merging-objects",
      "answers": [
        {
          "check": "computed-value-in-a-test#test-body",
          "form": "merging-objects"
        }
      ]
    },
    {
      "anchor": "building-an-object-from-entries",
      "answers": [
        {
          "check": "computed-value-in-a-test#test-body",
          "form": "building-an-object-from-entries"
        }
      ]
    },
    {
      "anchor": "building-an-array-from-a-length",
      "answers": [
        {
          "check": "computed-value-in-a-test#test-body",
          "form": "building-an-array-from-a-length"
        }
      ]
    },
    {
      "anchor": "a-math-call",
      "answers": [
        {
          "check": "computed-value-in-a-test#test-body",
          "form": "a-math-call"
        }
      ]
    },
    {
      "anchor": "serialising-or-parsing-json",
      "answers": [
        {
          "check": "text-past-its-reader#test-body",
          "form": "serialising-or-parsing-json"
        }
      ]
    }
  ]
}
```

- **Method:** Assert the whole returned value with `toEqual` against a written-out literal. Read list items by bare index after an assert, never with `find`.
- **You can tell because:** The expected value is a literal in the test.
- **Industry name:** Literal Value (Meszaros).

## Examples

### Branching with if
```ts
declare const parse: (text: string) => { readonly outcome: "ok"; readonly value: string } | { readonly outcome: "failed" };
const parsed = parse("a");
if (parsed.outcome === "ok") {
  expect(parsed.value).toBe("a");
}
```

Compare the whole result:

```ts
declare const parse: (text: string) => { readonly outcome: "ok"; readonly value: string } | { readonly outcome: "failed" };
expect(parse("a")).toEqual({ outcome: "ok", value: "a" });
```

### An optional chain after an index
```ts
declare const listTasks: () => readonly { readonly id: string; readonly status: "open" | "done" }[];
expect(listTasks()[0]?.id).toBe("a");
```

Assert the whole array:

```ts
declare const listTasks: () => readonly { readonly id: string; readonly status: "open" | "done" }[];
expect(listTasks()).toEqual([
  { id: "a", status: "open" },
  { id: "b", status: "done" },
]);
```

Or read the element by bare index after an assert:

```ts
declare const listTasks: () => readonly { readonly id: string; readonly status: "open" | "done" }[];
const tasks = listTasks();
assert.isDefined(tasks[0]);
expect(tasks[0]).toEqual({ id: "a", status: "open" });
```

### A method that picks or tests an element
```ts
declare const listTasks: () => readonly { readonly id: string; readonly status: "open" | "done" }[];
expect(listTasks().find((task) => task.id === "a")).toEqual({ id: "a", status: "open" });
```

Assert the whole array:

```ts
declare const listTasks: () => readonly { readonly id: string; readonly status: "open" | "done" }[];
expect(listTasks()).toEqual([
  { id: "a", status: "open" },
  { id: "b", status: "done" },
]);
```

Or read the element by bare index after an assert:

```ts
declare const listTasks: () => readonly { readonly id: string; readonly status: "open" | "done" }[];
const tasks = listTasks();
assert.isDefined(tasks[0]);
expect(tasks[0]).toEqual({ id: "a", status: "open" });
```

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
declare const requestFor: (task: { readonly body: string }) => { readonly method: "POST"; readonly path: string; readonly body: string };
const base = { method: "POST", path: "/tasks" } as const;
expect(requestFor({ body: "a" })).toEqual(Object.assign({}, base, { body: "a" }));
```

Write the whole object out:

```ts
declare const requestFor: (task: { readonly body: string }) => { readonly method: "POST"; readonly path: string; readonly body: string };
expect(requestFor({ body: "a" })).toEqual({ method: "POST", path: "/tasks", body: "a" });
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

Write the array out, and assert the whole array that comes back:

```ts
declare const pageOf: (rows: readonly { readonly id: number }[]) => readonly { readonly id: number }[];
expect(pageOf([{ id: 0 }, { id: 1 }, { id: 2 }])).toEqual([{ id: 0 }, { id: 1 }, { id: 2 }]);
```

### A Math call
```ts
declare const roundedOf: (amount: number) => number;
expect(roundedOf(2.5)).toBe(Math.round(2.5));
```

Write the number out:

```ts
declare const roundedOf: (amount: number) => number;
expect(roundedOf(2.5)).toEqual(3);
```

### Serialising or parsing JSON
```ts
declare const render: (row: { readonly id: string }) => string;
expect(JSON.parse(render({ id: "a" }))).toEqual({ id: "a" });
```

Assert the object the unit gives back, written out:

```ts
declare const rowOf: (row: { readonly id: string }) => { readonly id: string };
expect(rowOf({ id: "a" })).toEqual({ id: "a" });
```
