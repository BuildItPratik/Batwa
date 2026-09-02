# Contributing to Batwa

First off, thank you for considering contributing to Batwa! It's people like you that make Batwa such a great tool for inclusive digital payments.

## Where do I go from here?

If you've noticed a bug or have a feature request, make one! It's generally best if you get confirmation of your bug or approval for your feature request this way before starting to code.

## Branching Strategy

We follow a standard feature branch workflow:
1. `main` is the primary, deployable branch.
2. Create a new branch from `main` for your work. Use a descriptive name: `feature/add-new-payment-method`, `bugfix/fix-pin-validation`, or `docs/update-api-spec`.
3. Commit your changes.
4. Push your branch and open a Pull Request.

## Pull Requests

1. **Keep it focused:** A Pull Request should do one thing and do it well. Avoid lumping multiple unrelated changes together.
2. **Include Tests:** If you are adding a feature or fixing a bug, please include tests! The backend runs tests via `pytest` or `python test_endpoints.py`. The frontend runs tests via `pnpm test`.
3. **Pass CI:** Make sure all checks pass (typechecking, linting, tests).
4. **Link Issues:** If your PR resolves an open issue, link it using `Closes #123`.

## Development Setup

See the [README.md](README.md) for detailed setup instructions.

## Coding Standards

### Frontend
- We use React 19, TypeScript, and Vite.
- Use `pnpm` for package management.
- Ensure `pnpm typecheck` passes cleanly with no errors.
- Prefer functional components and hooks.

### Backend
- We use Python 3.10+ and FastAPI.
- Use `virtualenv` for isolating dependencies.
- Follow PEP 8 guidelines.

Thank you for contributing!
