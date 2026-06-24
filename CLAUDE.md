## Agent skills

### Issue tracker

Issues tracked in GitHub Issues via the `gh` CLI; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles using default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.

<!-- ai-harness:start -->

## Loop label policy

- A **prd-issue** carries `ready-for-agent` only — never `loop`.
- A **sub-issue** carries `ready-for-agent` + `loop`.

<!-- ai-harness:end -->

