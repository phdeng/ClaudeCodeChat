---
name: commit
description: Smart commit creation with conventional commits. Use when user says "commit" or requests committing changes. Handles staged file detection, suggests splits for multi-concern changes, and applies proper commit format without emoji prefixes.
---

# Commit Skill

Creates well-formatted commits following conventional commit standards.

## Core Features
- Staged vs unstaged detection - commits only staged files when present
- Split suggestions - analyzes diffs for multiple logical changes
- Conventional commits format: `<type>: <description>`
- Pre-commit hook integration
- Always `--signoff` for DCO compliance

## Process

### 1. Analyze Changes
```bash
git status --short

# Prefer staged files if any exist
if ! git diff --staged --quiet; then
  git diff --staged --stat
else
  git diff HEAD --stat
fi
```

### 2. Multi-Concern Detection
Suggest split if:
- Different patterns: `src/` + `test/` + `docs/`
- Mixed types: feat + fix + docs
- Unrelated concerns: auth logic + UI styling
- Large changeset: >500 lines

Ask user:
```
Multiple concerns detected:
1. Auth changes (src/auth/*)
2. UI updates (src/components/*)
3. Docs (README.md)

Split into 3 commits?
- feat: add JWT authentication
- style: update login UI
- docs: update auth documentation

[split/all]
```

### 3. Create Commit
Format: `<type>: <description>`

Rules:
- Imperative mood ("add" not "added")
- First line <72 chars
- Atomic (single purpose)
- Use body for "why" if needed

```bash
git commit --signoff -m "<type>: <description>"
```

## Commit Body Conventions

When changes need more context, add a body:

```bash
git commit --signoff -m "$(cat <<'EOF'
<type>: <description>

<body>
EOF
)"
```

### When to Include Body
- Multiple files changed
- Non-obvious reasoning
- Breaking changes
- Related issues/PRs

### Body Format
- Blank line after subject
- Wrap at 72 chars
- Explain "why" not "what"
- Use bullet points for lists

### Body Example
```
feat: add user authentication

- Implement JWT token validation
- Add protected routes middleware
- Include refresh token support

Closes #123
```

### Breaking Changes
Add exclamation mark (!) after type for breaking changes:
```
feat!: change API response format

BREAKING CHANGE: Response now returns { data, meta }
instead of flat object. Update all API consumers.
```

### 4. Handle --no-verify
If user requests `--no-verify`:
```
Warning: Requested to skip pre-commit hooks.
Bypasses: linting, tests, formatting
Reason: [ask user]
Approve? [yes/no]
```
Only proceed if confirmed.

## Commit Types

| Type | Use Case |
|------|----------|
| feat | New feature |
| fix | Bug fix |
| docs | Documentation |
| style | Formatting, styling |
| refactor | Code restructure |
| perf | Performance |
| test | Tests |
| chore | Build/tools |
| ci | CI/CD |
| security | Security fix |
| build | Build system |
| revert | Revert changes |
| wip | Work in progress |

## Split Examples

### Bad - Mixed concerns
```diff
+ src/auth/login.ts (feat)
+ src/components/Button.css (style)
+ README.md (docs)
```
Split into: 3 separate commits

### Good - Single concern
```diff
+ src/auth/login.ts
+ src/auth/middleware.ts
+ tests/auth.test.ts
```
One commit: `feat: add authentication`

## Critical Rules

### NEVER
- Add Claude signature to commits
- Commit without checking staged status
- Skip split suggestions for multi-concern
- Use past tense ("added" -> "add")
- Make first line >72 chars
- Bypass hooks without asking

### ALWAYS
- Use --signoff flag
- Analyze diff before commit
- Suggest splits when appropriate
- Use imperative mood
- Pick correct type
- Ask approval for --no-verify
