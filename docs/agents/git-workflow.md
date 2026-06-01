# Agent Git Workflow

Do not run history-changing git commands unless the user explicitly asks for that action in the current turn.

Inspection commands such as `git status`, `git diff`, and `git log` are fine. Staging, committing, pushing, tagging, versioning, resetting, and force operations are not fine unless requested as described below.

## User Verbs

| User says                                            | Agent action                                                                                                                                                                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `commit` or `commit this`                            | Stage the relevant files and run `git commit -m "<conventional-commit message>"`. Do not push. If there is nothing to commit, say so.                                                                                  |
| `push` or `ship it`                                  | If there are relevant uncommitted changes, commit them first. Then push the current branch. If the branch is already clean and ahead of origin, just push.                                                             |
| `open a PR`                                          | Push the current branch, then run `gh pr create --base main --head <branch>` with a Conventional Commit title (use `!` for breaking). Do not merge.                                                                    |
| `squash merge` or `merge the PR`                     | Run `gh pr merge --squash --delete-branch` once required checks pass. Then `git checkout main && git pull --ff-only`.                                                                                                  |
| `release patch`, `release minor`, or `release major` | Verify the working tree is clean. Run `npm version <bump>`, then `git push --follow-tags`. Commit first only if the user asked for that in the same turn.                                                              |
| `cut a pre-release X.Y.Z-rc.N`                       | Verify the working tree is clean. Run `npm version X.Y.Z-rc.N`, then `git push --follow-tags`.                                                                                                                         |
| `promote to staging`                                 | No-op. Explain that every push to `main` publishes `:edge`, and offer to push current work only if the user asked for a push.                                                                                          |
| `pin the server to X.Y.Z`                            | Update `LLMC_IMAGE_TAG` in the relevant `.env` or compose config. Do not SSH anywhere. Tell the user to run `docker compose -f compose.deploy.yaml pull && docker compose -f compose.deploy.yaml up -d` on the server. |

## Hard Rules

- Never run `git push --force`.
- Never run `git reset --hard` or checkout files to discard changes unless the user explicitly asks for that destructive operation.
- Never run `git tag` directly. Tags are created by `npm version`.
- Never edit `package.json`'s `version` field by hand.
- Never publish container images locally. CI publishes images.
- Agent-authored commits should use Conventional Commits: `<type>(<optional scope>): <imperative summary>`.

## Merge Strategy

- `main` stays linear. Feature, fix, and refactor branches land on `main` through a squash merge, so each branch becomes a single commit.
- The squash commit title is a Conventional Commit. Use `!` (such as `refactor!:`) when the change is breaking.
- Prefer a pull request: push the branch, open a PR against `main`, let the `node` and `docker` checks pass, then squash merge. Direct push to `main` is acceptable for small changes.
- A long-lived branch with noisy intermediate history may be squashed locally (`git reset --soft origin/main` then one commit) before its first push, so only the final commit reaches the remote.
- While the project is pre-1.0, breaking changes ship as a minor bump, not a major one. See [docs/RELEASING.md](../RELEASING.md).

Release and image-tag details live in [docs/RELEASING.md](../RELEASING.md).
