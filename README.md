# chating

Repository for the **chating** project.

## Branches

- `main` — default integration branch
- `sanket` — development branch
- `rafin` — development branch

## Setup & Security

- Keep secrets, API keys, certificates, and `.env` files out of version control (already excluded by `.gitignore`).
- Copy any template environment file (e.g., `.env.example`) to `.env` locally rather than committing credentials.

## Common Git Workflow

```bash
git checkout main
git pull origin main

git checkout <branch-name>
git merge main
```
