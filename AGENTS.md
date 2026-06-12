# AGENTS.md

Entry point for coding agents working in this repository. Read the focused doc for your task instead of the whole file.

## Project Identity

LLM Context Loader is a URL-to-markdown context loader for LLM tooling. The default bundle exposes Open WebUI and limited Jina-style HTTP adapters, fetches through Firecrawl, can run OpenAI-compatible chat-completions passes, and renders markdown with or without an XML diagnostic footer.

Firecrawl is one built-in source provider, not the identity of the project. Do not describe this as a Firecrawl patch or wrapper.

The source code is the authority. When a doc conflicts with live source, fix the doc or ask for direction rather than trusting the doc.

## Documentation Map

Read the row that matches your task. Each focused doc is self-contained for its domain.

| Task                                                                                   | Read                                                                                                                 |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Understand source layout, runtime flow, or dependency boundaries                       | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/agents/architecture-rules.md](docs/agents/architecture-rules.md) |
| Add or modify a built-in (source provider, LLM provider, step, renderer, adapter)      | [docs/agents/extension-authoring.md](docs/agents/extension-authoring.md)                                             |
| Edit YAML pipelines, providers, renderers, templates, or built-in knobs                | [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md)                                                                       |
| Run or configure the service, or change the environment surface                        | [docs/CONFIGURATION.md](docs/CONFIGURATION.md), [README.md](README.md)                                               |
| Work on logging, request context, errors, or diagnostics                               | [docs/agents/logging-and-errors.md](docs/agents/logging-and-errors.md)                                               |
| Touch auth, URL validation, upstream parsing, XML diagnostics, or other security paths | [docs/agents/security-boundaries.md](docs/agents/security-boundaries.md)                                             |
| Run smoke tests: start/stop, interpret footers, avoid common traps                     | [docs/agents/smoke-testing.md](docs/agents/smoke-testing.md)                                                         |
| Change code style, comments, TypeScript conventions, or tests                          | [docs/agents/coding-conventions.md](docs/agents/coding-conventions.md), [docs/TESTING.md](docs/TESTING.md)           |
| Commit, push, release, or change versioning and deployment                             | [docs/agents/git-workflow.md](docs/agents/git-workflow.md), [docs/RELEASING.md](docs/RELEASING.md)                   |
| Check scope before adding a feature                                                    | [docs/ROADMAP.md](docs/ROADMAP.md)                                                                                   |

## Always-On Rules

- Preserve user changes. Do not revert or overwrite unrelated work.
- Keep changes scoped to the user's request.
- Do not commit, push, tag, version, or rewrite git history unless the user explicitly asks for that action in the current turn.
- Do not edit `package.json`'s `version` field by hand. Version bumps use `npm version` only when explicitly requested.
- When changing the configuration surface, update the source schema, [config/llm-context-loader.yaml](config/llm-context-loader.yaml), [.env.example](.env.example), Compose files when relevant, and the configuration and customization docs in the same change.
- When changing behavior, keep the docs that describe it accurate in the same change.
- No gratuitous comments. Inline comments that narrate a change are prohibited ([coding-conventions](docs/agents/coding-conventions.md)). Before adding a comment, ask: will it still be useful after the transient context is gone?
- Don't over-document trivial changes. A new knob, helper, or internal refactor does not warrant updates to `ARCHITECTURE.md` or `extension-authoring.md`. Update only docs that directly describe the changed surface.

## Terminal Behavior on Windows

When using the terminal on Windows:

- Prefer single-line PowerShell commands.
- Avoid interactive commands, pagers, prompts, and commands that wait for input.
- Prefer `pwsh` or PowerShell with `-NoLogo -NoProfile`.
- For git commands, use non-interactive flags such as `--no-pager` and `--no-edit` when appropriate.
- If a command appears stuck after output is printed, do not blindly rerun it. First check whether the command already completed and inspect the visible terminal output.
