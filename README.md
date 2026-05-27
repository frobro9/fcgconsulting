# Capital Consulting

Full-service marketing consultancy specializing in brand strategy, creative, digital marketing, and analytics.

## Live Site

[capitalconsulting.ca](https://capitalconsulting.ca)

## Tech Stack

- Static HTML/CSS/JS — no build step required
- Hosted via GitHub Pages

## Branch Workflow

| Branch | Purpose |
|--------|---------|
| `main` | Production (live site) |
| `staging` | Staging/preview — review before going live |
| `feature/*` | Short-lived branches for individual changes |

**Always:** feature branch from `main` → PR into `staging` → merge `staging` into `main`.

## Local Development

```bash
mkdir -p /tmp/capital-consulting
cp index.html styles.css main.js /tmp/capital-consulting/
cd /tmp/capital-consulting && python3 -m http.server 4201
```

Then open [http://localhost:4201](http://localhost:4201).

## GitHub Actions

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `restrict-main.yml` | PR → `main` | Blocks PRs not coming from `staging` |
| `sync-staging.yml` | Push → `main` | Auto-syncs `staging` to match `main` |
