# Keeps state or settings across calls

```json
{
  "standing": "accepted",
  "owes": [
    {
      "principle": "no-hidden-effects"
    },
    {
      "principle": "external-behaviour-sits-at-a-boundary"
    },
    {
      "principle": "the-type-checker-proves-it"
    }
  ]
}
```

Settings are passed in when the unit is built. State that changes between calls lives only in an adapter, behind a port.
