# Map out at the adapter

```json
{
  "serves": {
    "principle": "no-leak-across-a-boundary"
  },
  "standing": "accepted",
  "reason": {
    "text": "\"As we should be runtime objects not json as soon as we leave a boundary\".",
    "standing": "accepted"
  }
}
```

- **Method:** Business logic hands the adapter our own value. Only the adapter turns it into the receiver's form (`JSON.stringify`, a status, a header).
- **You can tell because:** No outside form is built in business logic.
- **Industry name:** anticorruption layer (Evans).
