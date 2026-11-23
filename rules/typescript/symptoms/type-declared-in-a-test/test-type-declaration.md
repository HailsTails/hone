# test-type-declaration

```json
{
  "misses": "Inline type literals and declarations in ordinary source files imported only by tests.",
  "settingsTracedTo": "None."
}
```

A test declares a type, interface or enum of its own. Import the contract owned by the unit or its boundary so the test and the unit rely on the same type. Module and global augmentations are allowed.
