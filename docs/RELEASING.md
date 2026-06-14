# Release and Deployment

This project uses a small trunk-based workflow, GitHub Actions CI, and Docker images published to GitHub Container Registry.

## CI

[.github/workflows/ci.yml](../.github/workflows/ci.yml) runs on pull requests and pushes to `main`.

The `node` job runs:

```bash
npm ci
npm run typecheck
npm run typecheck:all
npm run build
npm test
```

The `docker` job builds the image on pull requests. On pushes to `main`, it also publishes these moving tags:

- `ghcr.io/sousekd/llm-context-loader:edge`
- `ghcr.io/sousekd/llm-context-loader:main`

Use `:edge` or `:main` for staging or for testing unreleased changes.

## Branches

- `main` is the long-lived branch and is always deployable.
- Short-lived `feat/<topic>`, `fix/<topic>`, or `chore/<topic>` branches are optional.
- Direct push to `main` is acceptable for this repository when appropriate.
- Let a pull request's `node` and `docker` checks finish before merging. A squash merge deletes the head branch, which cancels any of its still-running checks.

## Versioning

Releases use SemVer with a `v` git tag prefix, such as `v0.1.1` or `v0.2.0-rc.1`.

Do not edit `package.json` version by hand and do not create tags with `git tag`. Use `npm version`, which updates `package.json`, creates a version commit, and creates the matching `v*` tag in a single atomic step.

```bash
npm version patch       # 0.1.0 -> 0.1.1
npm version minor       # 0.1.0 -> 0.2.0
npm version major       # 0.1.0 -> 1.0.0
npm version 0.2.0-rc.1  # explicit pre-release
git push --follow-tags
```

While the project is in `0.x.y`, breaking changes may ship in a minor release, but the release notes should make that clear.

`npm version` runs the `preversion` script first, which invokes `npm run typecheck:all && npm run build && npm test`. A failing local suite aborts the version bump before the commit or tag is created, so a broken tree can never be tagged.

### Before tagging

- Working tree is clean and current commit is pushed.
- CI is green on `main`.
- Commits since the previous tag follow Conventional Commits — the release notes are generated from them.

## Release workflow

[.github/workflows/release.yml](../.github/workflows/release.yml) runs when a `v*.*.*` tag is pushed. It re-runs the Node typecheck, build, and tests; builds the Docker image; pushes image tags computed by `docker/metadata-action`; and creates a GitHub Release with auto-generated notes from the commits since the last tag.

| Tag              | Published when                 | Stability                              |
| ---------------- | ------------------------------ | -------------------------------------- |
| `:X.Y.Z`         | Stable `vX.Y.Z` tag            | Immutable release pin.                 |
| `:X.Y`           | Stable `vX.Y.Z` tag            | Moving latest patch in a minor series. |
| `:latest`        | Stable `vX.Y.Z` tag            | Moving latest stable release.          |
| `:X.Y.Z-rc.N`    | Pre-release tag                | Immutable pre-release pin.             |
| `:edge`, `:main` | Push to `main` after CI passes | Moving unreleased build.               |

Pre-release tags do not move `:latest` or a stable minor-series tag (`docker/metadata-action` is configured with `enable=${{ !contains(github.ref_name, '-') }}` for both).

## Docker deployment

[compose.yaml](../compose.yaml) is for local builds from the current checkout. [compose.deploy.yaml](../compose.deploy.yaml) is for server deployment with the published GHCR image. Both files read `.env` through Docker Compose variable interpolation, expose port `3010` by default, set every supported environment variable, and mount `./templates` into the container read-only.

First-time install, update, and rollback are the same three commands — only the `LLMC_IMAGE_TAG` value changes:

```bash
cp .env.example .env
# edit .env for provider URLs, model, keys, and LLMC_IMAGE_TAG (e.g. 0.1.0, 0.1.1, edge)
docker compose -f compose.deploy.yaml pull
docker compose -f compose.deploy.yaml up -d
```

- **Install / update**: pin `LLMC_IMAGE_TAG` to a newer immutable release such as `0.1.1`.
- **Roll back**: pin `LLMC_IMAGE_TAG` to the previous immutable release such as `0.1.0`.
- **Staging on every push to `main`**: pin `LLMC_IMAGE_TAG=edge` and repeat `pull` + `up -d` whenever you want to take the latest build.

[compose.deploy.yaml](../compose.deploy.yaml) uses `pull_policy: missing`, so Docker only fetches an image the first time it sees a tag locally. Immutable pins such as `:0.1.0` never need a refresh. Moving tags such as `:latest`, `:0.1`, `:edge`, and `:main` only update when you explicitly run `docker compose -f compose.deploy.yaml pull` before `up -d`.

After upgrades, `docker image prune -f` removes the now-unused previous image layers.
