# Contributing to Notes Print Optimizer

Thank you for your interest in contributing! This document explains the development
and release workflow and the coding guidelines for this project.

## Development & Release Workflow

This project uses a **two-repository model** to keep production safe:

| Repository | Role | Branch |
|------------|------|--------|
| `juyel-dev/Notes-Print-Optimizer` | **Production** (live users) | `main` (protected) |
| `juyel-dev-s-org/Notes-Print-Optimizer-forked` | **Development / testing / preview** | `main` + feature branches |

**Rules:**

- **All development happens in the fork** (`Notes-Print-Optimizer-forked`).
  New features, bug fixes, refactors, and experiments are committed and pushed
  to the fork only.
- **The production repository is never changed directly.** Its `main` branch is
  protected and only updated via an approved Pull Request from the fork.
- **The fork auto-deploys a preview** on every push to its `main` branch, so the
  latest development build can be tested at:

  > **Preview:** https://juyel-dev-s-org.github.io/Notes-Print-Optimizer-forked/

- The fork's base path is derived automatically from the repository name, so the
  same build config works in both repositories.

### Day-to-day flow

1. Create a feature branch in the fork: `git checkout -b feature/your-feature`
2. Make your changes, run `npm run test`, `npm run lint`, `npm run build`
3. Merge/commit into the fork's `main` to update the preview
4. Test the preview URL and exercise the functionality
5. When confirmed, open a **Pull Request from the fork to the production repo**
6. The PR must pass CI and receive approval before it is merged to production

> **Note:** The original repository also keeps a `develop` branch for historical
> reasons, but active development no longer uses it. All new work goes to the fork.

## Getting Started (local)

1. Clone the fork: `git clone https://github.com/juyel-dev-s-org/Notes-Print-Optimizer-forked.git`
2. Install dependencies: `npm install`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Run locally: `npm run dev`
5. Run tests: `npm run test`
6. Build to verify: `npm run build`

## Development Guidelines

### Code Style

- TypeScript strict mode is enabled
- Use functional React components with hooks
- Follow the existing file/folder structure
- Use Tailwind CSS for styling (no inline styles)
- Keep components small and focused

### Architecture

- **Pipeline plugins** go in `lib/plugins/`
- **Image kernels** go in `lib/kernels/` (JS) or `wasm/src/` (Rust)
- **UI components** go in `components/`
- **Services** (business logic) go in `lib/services/`
- **Workers** go in `lib/workers/`

### Testing

- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- Stress tests: `tests/stress/`
- Benchmarks: `tests/benchmarks/`
- E2E tests: `tests/smoke/` (Playwright)

All PRs must pass `npm run test` and `npm run build`.

### Commit Messages

Use conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `chore:` - Maintenance
- `perf:` - Performance improvement
- `test:` - Adding tests
- `refactor:` - Code refactoring

## Reporting Issues

- Use the GitHub Issues tab
- Include browser, OS, and device information
- Attach sample PDFs if relevant (small files only)
- Describe expected vs actual behavior

## License

By contributing, you agree that your contributions will be licensed under the Juyel Source License (JSL) v1.0.
