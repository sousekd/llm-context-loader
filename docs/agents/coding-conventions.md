# Coding Conventions

Agent-only rule sheet. Keep it terse. Architecture rules override style. Keep edits scoped unless the user asks for a style pass. When this file and [.prettierrc.json](../../.prettierrc.json) overlap, they must agree.

## Scope

- Production rules apply to `src/**/*.ts`.
- Tests use the test exception below.
- Put code in the owning layer; never cross architecture boundaries for convenience.

## Formatting

- Prettier is source of truth via `esbenp.prettier-vscode` and npm `format` scripts.
- `printWidth: 120`; two spaces; no tabs; semicolons; double quotes; LF; no trailing commas; `quoteProps: "as-needed"`; object spacing on; `bracketSameLine: false`; `arrowParens: "avoid"`; preserve Markdown prose wrapping.
- Import groups, alphabetized by module path: side effects, external values, local values, external type-only, local type-only. One blank line between groups.
- Use one blank line between declarations and meaningful phases. No multiple blank lines or decorative padding.
- Keep small literals inline. Use multi-line literals for configs, diagnostics, request bodies, and nested values. Extract repeated or semantic shapes.

## Comments

- Production starts with `document-all`: every file, exported declaration, interface, type, class, public method, constructor, and private helper has useful JSDoc unless a reviewed local exception is less noisy.
- Comments are agent context. Preserve intent, ownership, boundary, invariant, failure behavior, side effect, and domain vocabulary not obvious from syntax.
- A good comment prevents a plausible wrong edit. It can answer: why this exists; which layer/adapter/provider/renderer/descriptor/artifact/diagnostic/pipeline/YAML/request-context boundary owns it; what contract/trust boundary/error/status/diagnostic/fallback/rollback/deletion/logging side effect must hold; what future edits must avoid.
- Bad comments repeat names, narrate syntax, describe temporary steps, or reassure vaguely.
- File header JSDoc states architectural role, key collaborators, and non-obvious boundary or non-goal.
- Declaration JSDoc uses descriptive present tense: "Builds...", "Represents...", "Carries...".
- Prefer one useful sentence. Use multi-line JSDoc for contracts, invariants, boundaries, side effects, domain rules, or negative constraints.
- Use stable project vocabulary for retrieval: configured pipeline, descriptor registry, host tool, diagnostic footer, body rollback, concurrency group, upstream error, capture artifact.
- Use `@param`, `@returns`, and similar tags rarely; TypeScript signatures carry routine shape info.
- Keep comments stable under refactors. If a comment explains the algorithm step by step, improve names or extract helpers.
- Inline comments inside production function bodies are prohibited. Move explanation to naming, extraction, types, or declaration JSDoc.
- Avoid `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `prettier-ignore`, `TODO`, `FIXME`. If unavoidable, use narrow scope and a clear reason; tracking issue optional.

## TypeScript

- Explicit return types for exported functions, exported methods, and public APIs. Private helpers may use readable inference.
- `interface` for object contracts. `type` for unions, tuples, mapped/conditional types, intersections, and primitive aliases.
- Generic names are descriptive and `T`-prefixed (`TConfig`, `TValue`, `TDescriptor`). Bare `T` only in tiny obvious utilities.
- Default config/payload generics to `unknown`; constrain with `extends` when implementation depends on shape.
- Avoid `any` except unavoidable third-party interop behind a named alias.
- `readonly` properties by default for interfaces, exported types, constructor arg objects, config, diagnostics/report shapes, and function arg object types. Mutable local accumulators are fine.
- `function` declarations for top-level named operations. Arrow functions mainly for callbacks, closures, and inline transforms.
- Named exports only. Avoid default exports and broad `export *` unless the public surface is intentional and stable.
- `undefined` means absent/optional. `null` only for explicit domain sentinels, deletion markers, or upstream JSON semantics.
- Avoid `as` and non-null assertions by default. Allow localized assertions at typed registry, third-party/request boundaries, or after nearby runtime checks. Prefer guards or schema validation for untrusted data.

## Classes And Constructors

- Parameter properties only for simple one-argument classes.
- Multi-argument constructors and dependency bags use explicit private fields plus assignments.
- Every object-typed constructor argument gets a named interface, not an inline object type.

## Errors And Async

- Use `try/catch` only to translate unknown failures into project errors, log, classify timeout/abort, or pair with cleanup.
- Do not catch only to rethrow unchanged.
- Catch variable `cause` when wrapping into another project error; `error` when inspecting, branching, or logging.
- Use `finally` for required cleanup.
- Promise `.catch(...)` is allowed for concise expression-local handling; prefer `try/catch` for multi-statement flows or shared cleanup/classification.

## Schemas

- Use named Zod schemas and `z.infer<typeof schema>` for config types.
- Keep chained modifiers in Prettier layout.
- Extract nested schemas when reused or when nesting hides the parent shape.

## Control Flow

- Omit braces for single-statement `if`, `else`, loops, and guard clauses.
- Require braces for multi-statement branches; do not wrap a single statement in braces unless syntax requires it.
- Accept Prettier's compact same-line output for unbraced single-statement bodies.
- Use Prettier's `} else {` placement.
- Use multi-statement braces when vertical structure matters.

## Naming And File Shape

- `PascalCase`: classes, interfaces, types, schemas, enum-like objects.
- `camelCase`: functions, variables, parameters, properties, methods.
- `UPPER_SNAKE_CASE`: true module constants only.
- Prefer domain names over vague `data`, `item`, `result` when meaningful names exist.
- One-letter names only for tiny local indexes/callbacks.
- File order: header, imports, module constants, public/exported types/interfaces, private types/interfaces, exported classes/functions, private helpers.

## Tests

- Tests are concise. Every test file starts with a short JSDoc header explaining why it exists.
- No other test comments by default. Prefer clearer `describe`, `it`, helper, and fixture names.
- Behavior-focused names; prefer one behavior per `it`.
- Use helpers/fixtures to remove repetition. Keep assertions close to action.
- Avoid snapshots unless output is intentionally large and stable.
- No production-style JSDoc on test helpers.

For test layout, commands, and shared helpers, see [docs/TESTING.md](../TESTING.md).
