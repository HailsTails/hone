# unread-parameter

```json
{
  "misses": "Leading unread parameters before a read parameter or a constructor parameter property. Functions that read arguments, unread parameter properties and fields of objects left whole. Setter parameters are required by the language.",
  "settingsTracedTo": "None."
}
```

The signature demands a parameter or destructured field the unit never reads. Callers build and pass input that changes nothing.
