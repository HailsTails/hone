# test-body

```json
{
  "flagsBeyondTheSymptom": "unit's own API (edition 1).",
  "settingsTracedTo": "the edition: backwards compatibility for adopters since the npm release."
}
```

Values computed, mutated or picked in a test file. These run with the other [test-body checks](../../../README.md#checks-the-test-body-checks), which share their scope, editions and settings.

## Flags

### A method that picks or tests an element
A call named `at`, `every`, `filter`, `find`, `findIndex`, `findLast`, `findLastIndex`, `includes`, `indexOf`, `lastIndexOf` or `some`. Edition 1.

### A method that computes a value
A call named after a string or array method that gives back a new value or walks the list: `map`, `reduce`, `forEach`, `join`, `slice`, `split`, `replace`, `sort`, `trim`, `keys`, `values` and similar. Edition 1.

### A method that mutates
A call named `copyWithin`, `fill`, `pop`, `push`, `reverse`, `shift`, `splice` or `unshift`. Edition 1.

### Merging objects
`Object.assign`. Edition 2 adds it.

### Building an object from entries
`Object.fromEntries`. Edition 2 adds it.

### Building an array from a length
`Array.from`. Edition 2 adds it.

### A Math call
Any `Math` method. Edition 2 adds it.

## Margin

A method call is flagged wherever it could be the string or array method of that name.

- Not flagged: a call with one of those names whose arguments no string or array method of that name accepts, which makes it the unit's own API. Either it passes an object literal where none of them takes an object, such as `paths.join({ segments: ["a", "b"] })`, or it passes more arguments than any of them takes, such as `screen.keys("x", true, true)`.
- Still flagged, though they look like that:
  - a call whose receiver traces back to a built-in namespace such as `Object` or `Math`, a package or `node:` module (imported, required or loaded with `import()`) other than a `#` import or a package some `package.json` in the repository names, or a string or array literal. The trace follows variables declared in the test file, including names destructured from a traced module or namespace, such as `posix` after `const { posix } = path`, and a property read directly off an object literal declared there, such as `deps.path` after `const deps = { path }`;
  - a call that spreads its arguments;
  - an object at a position where a string or array method takes one, such as `rows.includes({ id: "a" })`, `rows.push({ id: "a" })`, `rows.reduce(sum, { total: 0 })`, `rows.find(isA, {})` or `text.split({ [Symbol.split]: splitter })`.
- What this check cannot know: it reads names and syntax, not types, so it cannot tell what a receiver is.
  - It flags the unit's own method given a variable, such as `repository.find(query)`.
  - It misses a string or array method taken off its receiver before the call.
  - It does not trace a receiver that is a function parameter, an `it.each` row, a value from another module (even a relative module that re-exports a package), a name destructured from an object literal, or a property nested deeper in one, such as `deps.nested.path`; it reads these as the unit's own.
  - It releases a method of another built-in or library type that shares a name, such as a stream's `values` or `reduce`, when that call passes an object or more arguments than the string or array method takes.
  Only a check that reads types knows a receiver's identity, and Hone does not have one yet.

An array too long to read written out, such as one row past a page size of 1,000, is flagged too. A record at the site answers it.

`JSON.stringify` and `JSON.parse` are [text-past-its-reader#test-body](../text-past-its-reader/test-body.md).
