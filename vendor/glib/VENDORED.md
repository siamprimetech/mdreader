# Vendored `glib`

This is `glib` 0.18.5 from crates.io, with one change: the fix for
[RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429)
(`GHSA-wrw7-89jp-8q8g`), the unsoundness in the `Iterator` and
`DoubleEndedIterator` implementations for `glib::VariantStrIter`.

## What was wrong

`VariantStrIter::impl_get` passed `&p`, an immutable reference to a pointer,
to `g_variant_get_child`, which writes through it. The compiler is free to
ignore a write through an immutable reference, so the pointer could still be
null when it was handed to `CStr::from_ptr`, which is undefined behaviour.

The fix is the one upstream made in `glib` 0.20: make the binding mutable and
pass `&mut p` instead. It is in `src/variant_iter.rs`, and it is the only
change to the code:

```diff
-            let p: *mut libc::c_char = std::ptr::null_mut();
+            let mut p: *mut libc::c_char = std::ptr::null_mut();
...
-                &p,
+                &mut p,
```

## The lint allowances

`Cargo.toml` also carries this:

```toml
[lints.rust]
unused_parens = "allow"
mismatched_lifetime_syntaxes = "allow"
```

The crate is older than those lints, and its code is not ours to change. A
copy from crates.io cannot say this, so it warns about its own parentheses and
lifetimes on every fresh build. Here it does not.

## Why it is here

`glib` comes in through `gtk`, and `gtk` comes in through `tao` and `wry`,
which Tauri uses on Linux. `tao` asks for `gtk` `^0.18`, and the `gtk` 0.18
series uses `glib` 0.18. The fixed `glib` is 0.20 and later, which belongs to
the `gtk` 0.19 series, and no release of `tao` or `wry` asks for that yet.

Until one does, this copy is the fix. It is applied with a patch in
`src-tauri/Cargo.toml`:

```toml
[patch.crates-io]
glib = { path = "../vendor/glib" }
```

## When it can go

As soon as `tao` moves to `gtk` 0.19 or later, `glib` 0.20 or later arrives
in the tree on its own. The patch and this directory should then be deleted.

## Checking that it is still the same crate

The published crate is `glib` 0.18.5, and the copy here is that crate with the
change above. To see that nothing else has drifted:

```bash
curl -sSLO https://static.crates.io/crates/glib/glib-0.18.5.crate
tar xzf glib-0.18.5.crate
diff -r glib-0.18.5 vendor/glib
```

The only differences should be `src/variant_iter.rs`, the lint allowances in
`Cargo.toml`, and this file.

## Licence

`glib` is under the MIT licence. The licence text is in `LICENSE`, and the
crate's own metadata is unchanged.
