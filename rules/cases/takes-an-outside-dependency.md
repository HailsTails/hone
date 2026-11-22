# Takes an outside dependency

```json
{
  "standing": "accepted",
  "owes": [
    {
      "principle": "outside-risk-is-carried-on-purpose"
    },
    {
      "principle": "our-code-reads-in-the-common-language"
    },
    {
      "principle": "external-behaviour-sits-at-a-boundary"
    },
    {
      "principle": "one-place-decides"
    },
    {
      "rule": "outside-dependencies-stay-at-boundaries"
    },
    {
      "rule": "outside-dependencies-justified"
    },
    {
      "rule": "fixed-versions"
    },
    {
      "rule": "tools-live-in-the-repo"
    },
    {
      "rule": "upstream-stays-untouched"
    }
  ]
}
```

A record names the native way weighed and why it was not enough. It is used only inside the recorded boundary that needs it, with no wrapper, and its types and vocabulary never reach business logic. It never makes one of our decisions.
