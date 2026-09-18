# 04: Secure Backend with CORS allowlist

**What to build:** 
Restrict API access to authorized frontend domains via a configurable `CORS_ORIGIN` environment variable, closing a security gap in production. The API should reject requests from unlisted origins.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Update `server.js` to read allowed CORS origins from `process.env.CORS_ORIGIN`
- [x] Update `cors` middleware to validate the request origin against the allowlist (defaulting to localhost)
- [x] Add `CORS_ORIGIN` documentation to `.env.example`
- [x] Verify API requests work from the frontend domain but are rejected from an unauthorized domain
