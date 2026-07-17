# UGM-AICare Frontend (Next.js)

## Local development

This frontend is typically developed via Docker Compose from the repo root:

```bash
./dev.sh up
```

The frontend is exposed at `http://localhost:22000`.

## Development API routing

This repo supports two practical development modes:

1. Direct mode (recommended)

- Set `NEXT_PUBLIC_API_URL=http://localhost:22001`.
- Browser requests go directly to the backend.
- This matches the split-subdomain production deployment pattern.

1. Proxy mode (optional)

- Leave `NEXT_PUBLIC_API_URL` unset or empty.
- The frontend uses relative `/api/v1/*` paths.
- In Docker Compose, Next.js can proxy `/api/v1/*` to the backend service.

## Production deployment (split subdomain)

The intended deployment uses distinct subdomains:

- Frontend: `https://aicare.sumbu.xyz`
- Backend: `https://api.aicare.sumbu.xyz`
