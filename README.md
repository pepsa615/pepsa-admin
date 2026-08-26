# Pepsa Admin Frontend

Independent React and TypeScript browser application for the Pepsa administration
control plane. It communicates only with the versioned admin backend API.

## Local development

Requirements: Node.js 22.12 or newer and pnpm 11.

```bash
cp .env.example .env
pnpm install
pnpm dev
```

The frontend runs on `http://localhost:5174` and proxies `/admin-api` requests to
the standalone admin backend on `http://localhost:3300` by default.

It contains no platform credential and never calls BAS directly. Authentication
uses an opaque `HttpOnly` session cookie; the CSRF token is held only in memory.
The production container serves the SPA on port 8080 with restrictive security
headers. Pepsa brand assets are copied into this repository so deployments stay
independent.

The backend OpenAPI release is pinned by version and SHA-256 in `contracts/admin-api.lock.json`. Set `ADMIN_API_CONTRACT_SOURCE` to the downloaded release artifact and run `pnpm contract:generate`; CI rejects stale generated types or a checksum mismatch.

## Verification

```bash
pnpm typecheck
pnpm contract:check
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm lint
pnpm build
pnpm format:check
```

The Playwright suite covers login, MFA, assigned-platform and environment switching, permission denial, step-up authentication, and approval-bound credential rotation. CI installs Chromium and runs these workflows on Linux.
