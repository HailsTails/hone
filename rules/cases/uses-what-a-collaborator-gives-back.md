# Uses what a collaborator gives back

```json
{
  "standing": "accepted",
  "owes": [
    {
      "principle": "tests-are-ours"
    },
    {
      "principle": "one-place-decides"
    },
    {
      "rule": "written-out-answers"
    }
  ]
}
```

Every collaborator whose result it uses, our own units included, is passed in. The test stubs it with a written-out value and asserts only what the unit returns and calls. A stub that needs logic means the port or the collaborator holds too much: fix that.
