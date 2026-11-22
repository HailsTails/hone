# Double with a body

```json
{
  "group": "Tests",
  "seen": "A double that has a function body at all: `vi.fn(impl)`, `mockImplementation`, or a hand-written function or object double. A body that only returns a value is included.",
  "mayIndicate": [
    {
      "case": "uses-what-a-collaborator-gives-back",
      "points": [
        {
          "rule": "written-out-answers"
        }
      ]
    },
    {
      "case": "does-one-job",
      "situation": "the port the stub stands in for",
      "points": [
        {
          "rule": "handed-what-it-uses"
        }
      ]
    },
    {
      "case": "does-one-job",
      "situation": "the collaborator the stub stands in for",
      "points": [
        {
          "rule": "doer-or-orchestrator"
        }
      ]
    }
  ],
  "breachUsuallySits": "in a port too wide, or in a collaborator holding two decisions",
  "seenBy": [
    "syntax"
  ],
  "reports": "seen-to-breach",
  "recipes": [
    "stub-with-vifn"
  ],
  "correctUses": [
    {
      "situation": "a fake, where a stub cannot do the test",
      "kind": "deviation",
      "at": "from Stub with vi.fn"
    }
  ]
}
```

"Exact returns can use mockreturn or mockresolve".

- **The breach a check could name:** the port it fills, by types.
- **To name the breach, a check needs:** types: the port the double fills, and its uncalled methods.
