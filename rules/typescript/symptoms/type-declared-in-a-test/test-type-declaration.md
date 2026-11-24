# test-type-declaration

```json
{
  "misses": "Inline type literals and declarations in ordinary source files imported only by tests.",
  "settingsTracedTo": "None."
}
```

A test declares a type, interface or enum of its own. Import the contract owned by the unit or its boundary so the test and the unit rely on the same type. Module and global augmentations are allowed. So is a top-level `type`, not exported, used only as the `it.each` or `describe.each` row type: one flat object or tuple, readonly or not, whose members are primitives, types imported by name, or readonly lists of imported types.
