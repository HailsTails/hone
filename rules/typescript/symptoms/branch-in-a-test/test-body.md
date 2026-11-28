# test-body

```json
{
  "flagsBeyondTheSymptom": "unit's own API (edition 1).",
  "settingsTracedTo": "the edition: backwards compatibility for adopters since the npm release."
}
```

Branches in a test file. These run with the other [test-body checks](../../../README.md#checks-the-test-body-checks), which share their scope, editions and settings.

## Flags

### Branching with if
An `if` statement. Edition 1.

### A ternary
A ternary expression. Edition 1.

### A short-circuit
`??`, `||` or `&&`, or an assignment form `??=`, `||=` or `&&=`. Edition 2 adds it.

### An optional chain after an index
Optional chaining straight after an index, as in `rows[0]?.id`, `mock.instances` and `mock.contexts` included. Edition 2 adds it.

### An optional chain on a mock call
Optional chaining after an index into `mock.calls`, or on `mock.lastCall`. Edition 2 adds it.

### An optional chain on a mock result
Optional chaining after an index into `mock.results`. Edition 2 adds it.

### An optional chain on a property
Any other optional property or index, `a?.b` or `a?.[key]`. Edition 2 adds it.

### An optional call
An optional call, `f?.()`. Edition 2 adds it.

### A switch
A `switch` statement. Edition 2 adds it.
