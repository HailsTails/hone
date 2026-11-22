# Uses a system or service outside the program

```json
{
  "standing": "accepted",
  "owes": [
    {
      "principle": "external-behaviour-sits-at-a-boundary"
    },
    {
      "principle": "no-leak-across-a-boundary"
    },
    {
      "principle": "one-place-decides"
    },
    {
      "rule": "handed-what-it-uses"
    },
    {
      "rule": "outside-dependencies-stay-at-boundaries"
    },
    {
      "rule": "ports-declared-inside"
    }
  ]
}
```

Business logic is handed a port named for the capability, not the mechanism, speaking only our types. One implementation per capability touches it and may fill several narrow ports. The protocol is its own adapter. Each adapter is a recorded boundary.
