# direct-global-use

```json
{
  "misses": "Destructured aliases, indirect calls or references, and dialog calls through other receivers or parenthesised receivers.",
  "settingsTracedTo": "The edition preserves compatibility for existing selections."
}
```

Direct reads of process globals and direct console use.

A locally supplied value with the same name passes. Reads of globals still report after an ambient declaration or a canonical Node import or require.

Edition 2 also covers unbound `alert`, `confirm`, and `prompt` calls, including calls on the unbound `window` global.
