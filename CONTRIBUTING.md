# Contributing

## Scope

This repository uses automated coding agents and human contributors. All contributors must preserve
the existing architecture, quality gates, security rules, and English documentation policy.

## Git Authorization

Coding agents operate in read and edit mode by default. The following operations require explicit
authorization from the user for the exact operation:

- `git add`
- `git commit`
- `git push`
- `git tag`
- `git merge`
- `git rebase`
- Branch deletion

Commit and push authorization are independent. Authorizing a commit does not authorize a push.
Agents must never amend commits, force-push, skip hooks, or modify Git configuration unless explicitly
requested.

Before an authorized commit, the agent must inspect:

```bash
git status
git diff
git diff --cached
git log --oneline -10
```

Only files belonging to the requested change may be staged. Do not stage `.env` files, credentials,
generated output, dependency directories, or unrelated changes made by another contributor.

## Commit Standard

Use English Conventional Commit messages:

```text
<type>(<scope>): <imperative summary>
```

Allowed types include `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, and
`chore`. Keep the subject concise and keep every commit body line at or below 100 characters.

Examples:

```text
fix(api): preserve process environment precedence
docs(repo): document environment file responsibilities
chore(vscode): configure i18n Ally locale discovery
```

Keep commits focused. Separate runtime fixes, documentation, tooling, and unrelated refactors into
different commits.

## Required Verification

Run the relevant checks before requesting review:

```bash
pnpm check
pnpm build
pnpm audit
```

For API changes that require local services, start the infrastructure first with `pnpm infra:up`.
Report failed checks and environmental blockers instead of hiding or bypassing them.

## Validation and UI Conventions

- Validate interactive and external input at its boundary with Zod schemas.
- Use `safeParse` when validation errors should be returned to a user rather than thrown.
- Keep password validation aligned with Better Auth: minimum 8 and maximum 128 characters.
- Use `SyntheticEvent<HTMLFormElement>` for React form handlers that only need `preventDefault`.
- Use `ChangeEvent` or another specific event type when a handler needs event data.
- Use canonical Tailwind CSS v4 utilities, including `bg-linear-to-r` for linear gradients.

## Review and Branch Protection

The repository should enforce these controls in the Git hosting platform:

- Protect `main`, `preview`, and `develop` from direct pushes.
- Require pull requests and at least one approval for protected branches.
- Require `pnpm check`, build, audit, and security checks before merging.
- Disable force-push and branch deletion on protected branches.
- Require secret scanning and dependency vulnerability checks.
- Give automation tokens the minimum permissions required for their job.

Local agent instructions are not a security boundary. Branch protection and token permissions are the
technical controls that prevent unauthorized remote changes.
