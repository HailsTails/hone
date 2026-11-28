# it.each over typed rows

```json
{
  "serves": [
    {
      "rule": "straight-through-tests"
    }
  ],
  "standing": "accepted",
  "reason": {
    "text": "\"It's just boilerplate for cases being tested.\"",
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
      "anchor": "a-ternary",
      "answers": [
        {
          "check": "branch-in-a-test#test-body",
          "form": "a-ternary"
        }
      ]
    },
    {
      "anchor": "a-switch",
      "answers": [
        {
          "check": "branch-in-a-test#test-body",
          "form": "a-switch"
        }
      ]
    }
  ]
}
```

- **Method:** Several cases of one behaviour are one `it.each<Row>([...])`. `Row` is a declared type whose members are primitives, types imported from non-test modules, or readonly lists of imported types. Each row writes out its input and its expected output.
- **You can tell because:** Every row is a literal. No row is built, mapped or picked.
- **Industry name:** Parameterized Test (Meszaros), with rows typed and written out.

## Examples

### Branching with if
```ts
declare const gradeFor: (score: number) => string;
const score = 60;
const grade = gradeFor(score);
if (score >= 50) {
  expect(grade).toBe("pass");
}
```

Write one typed row per case:

```ts
declare const gradeFor: (score: number) => string;
type Row = { readonly score: number; readonly expected: string };
it.each<Row>([
  { score: 60, expected: "pass" },
  { score: 40, expected: "fail" },
])("grades $score as $expected", ({ score, expected }) => {
  expect(gradeFor(score)).toBe(expected);
});
```

### A ternary
```ts
declare const discountFor: (order: { readonly quantity: number }) => number;
const quantity = 10;
expect(discountFor({ quantity })).toBe(quantity >= 10 ? 5 : 0);
```

Write one typed row per case:

```ts
declare const discountFor: (order: { readonly quantity: number }) => number;
type Row = { readonly quantity: number; readonly expected: number };
it.each<Row>([
  { quantity: 10, expected: 5 },
  { quantity: 9, expected: 0 },
])("gives $expected off an order of $quantity", ({ quantity, expected }) => {
  expect(discountFor({ quantity })).toBe(expected);
});
```

### A switch
```ts
declare const labelFor: (basket: { readonly count: number }) => string;
const basket = { count: 1 } as const;
switch (basket.count) {
  case 1:
    expect(labelFor(basket)).toBe("1 item");
}
```

Write one typed row per case:

```ts
declare const labelFor: (basket: { readonly count: number }) => string;
type Row = { readonly count: number; readonly expected: string };
it.each<Row>([
  { count: 1, expected: "1 item" },
  { count: 2, expected: "2 items" },
])("labels a basket of $count", ({ count, expected }) => {
  expect(labelFor({ count })).toBe(expected);
});
```
