# Extension outside the vendored code

```json
{
  "serves": {
    "rule": "upstream-stays-untouched"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"this must be justified as additional drift as impossible to apply as an extension instead\".",
    "standing": "accepted"
  }
}
```

- **Method:** A change is made through the vendored code's extension points or config, in a folder of ours.
- **You can tell because:** No diff inside the vendored folder. An edit there breaches Upstream stays untouched. It is held only by an [authorised location](../../record-kinds/authorised-location.md) on Edit inside vendored code that names its case and when it should be dropped.
- **Industry name:** Open-Closed Principle (Martin).
