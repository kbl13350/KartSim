# Manual repair to the heuristic output

Wakaru 1.13.0 converted one object assignment into a class static method:

```js
static ArrayBuffer() { this.reset(); }
```

The next statement uses `w.ArrayBuffer.prototype`, which fails because a class static method has no constructor prototype. The original minified bundle has `w.ArrayBuffer=function(){this.reset()}`. `../tools/fix-wakaru.py` restores that assignment in this copy only. The unmodified Wakaru output and its generated map remain in `../wakaru/`; that map does **not** apply to this manually repaired file.

The repaired code passed `node --check` and reached a local time-attack track in a browser. This does not prove every game path behaves identically to the original bundle.
