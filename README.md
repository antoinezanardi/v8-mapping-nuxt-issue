# V8 Coverage Source Map Drift in Vue SFC with Nuxt + @nuxt/ui

## Description

V8 code coverage reports **false uncovered lines, phantom "if" branches, and incorrect function mappings** in Vue Single File Components (SFCs) when the Nuxt Vite plugin chain processes them. All tests pass, all code paths are exercised, yet `@vitest/coverage-v8` reports less than 100% coverage.

## Reproduction

```bash
pnpm install
pnpm run test:coverage
```

### Expected

All 4 tests pass. Coverage should be **100%** across all metrics since every line, branch, function, and statement is exercised.

### Actual

All 4 tests pass, but coverage reports:

```
------------|---------|----------|---------|---------|-------------------
File        | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------|---------|----------|---------|---------|-------------------
 MyForm.vue |   92.85 |       50 |     100 |    92.3 | 30
------------|---------|----------|---------|---------|-------------------
```

- **Line 30** (`}` — closing brace of `triggerFormSubmit`) is reported as uncovered, but the function is called and tested
- **Branches: 50%** — a phantom `"if"` branch appears in `coverage-final.json` at a line that has no `if` statement in the source
- **Statements: 92.85%** — a statement is falsely reported as uncovered

## Root Cause Analysis

The issue is a **source map position drift** in the multi-step Vite transform pipeline for Vue SFCs:

1. `@vitejs/plugin-vue` compiles the SFC (script setup + inline template) -> source map #1
2. `esbuild` strips TypeScript type annotations -> source map #2 (chained with #1)
3. Nuxt's `unimport` plugin injects auto-import statements at the top of the file -> source map #3 (chained with #2)
4. `@nuxt/ui` registers additional component auto-imports -> more transform layers

Each chaining step can introduce position errors. When V8 coverage data is mapped back through the final chained source map, the accumulated errors cause:

- **Functions mapped to wrong line numbers** (e.g., `onSubmit` at line 25 in source gets mapped to line 28+ in coverage)
- **Phantom "if" branches** — compiled template cache expressions (`_cache[N] || (...)`) map back to incorrect source positions, creating `type: "if"` branches where none exist
- **Statements reported as uncovered** at wrong positions

### Evidence from `coverage-final.json`

After running `pnpm run test:coverage`, inspect `coverage/coverage-final.json`:

```json
{
  "branchMap": {
    "0": { "type": "if", "loc": { "start": { "line": 29 } } }
  },
  "b": {
    "0": [0, 1]
  }
}
```

Line 29 in the source is `await form.value.submit();` — there is no `if` statement there. The phantom branch comes from the compiled template's cache conditional being incorrectly source-mapped.

### What does NOT trigger the bug

Removing `defineExpose` + `useTemplateRef` + `triggerFormSubmit` while keeping the rest identical makes coverage report 100%. The additional code complexity from these constructs creates enough source map surface area for the chaining drift to manifest.

### Standalone SFC compilation is correct

Compiling the same SFC with `@vue/compiler-sfc` + `esbuild` directly (outside the Nuxt plugin chain) produces **correct source maps**. The bug only manifests when the full Nuxt Vite plugin chain runs with its additional transform layers.

## Environment

| Package | Version |
|---------|---------|
| nuxt | 4.4.2 |
| @nuxt/ui | 3.1.3+ |
| vitest | 4.1.3 |
| @vitest/coverage-v8 | 4.1.3 |
| @vitejs/plugin-vue | 6.0.5 |
| vue | 3.5.30 |
| vite | 7.3.1 |
| Node.js | 25.8.1+ |

## Minimal Trigger Conditions

The bug requires all of these in the same SFC:
- `@nuxt/ui` module loaded (provides UForm, UFormField, UInput auto-imports + additional Vite transforms)
- `useTemplateRef` referencing a template element
- `defineExpose` exposing a function
- An async function with an `if` guard (e.g., `triggerFormSubmit`)
- A template using Nuxt UI components (`UForm`, `UFormField`, `UInput`)

Removing any one of `defineExpose`, `useTemplateRef`, or the `triggerFormSubmit` function eliminates the bug.