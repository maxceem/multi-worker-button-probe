Multi-Worker Deploy-button feasibility probe

This template contains only an echo WebSocket Durable Object and a discovery
Worker. It has no application code, provider credentials, D1 database, quota,
billing, authentication, production migration, or automatic release cleanup.

To test the actual button:
1. Publish this directory as a new public GitHub repository.
2. Open https://deploy.workers.cloudflare.com/?url=<public-repository-URL>.
3. Use the automatically detected npm run deploy command and generated token.
   Do not add custom token permissions for the first attempt: the purpose is
   to verify the default onboarding experience. Choose a short Worker name.
4. Record whether companion creation, DO provisioning, service binding,
   subdomain lookup, health check, and primary deployment all succeed.
5. Open the primary Worker's JSON response to find the direct WebSocket URL.
   Connect there and send a message; the echo is prefixed with the release ID.
6. Keep that connection open, change realtime.js, and trigger the next build.
   The old socket should retain its release ID and new discovery should point
   to the newly created Worker. An unchanged realtime file should be reused.
7. Remove the primary Worker first, then all its <name>-rt-* companions.

Package deploy is the same entry point usable by CLI and Workers Builds.
Only companion subprocesses clear WRANGLER_CI_OVERRIDE_NAME and
WRANGLER_CI_MATCH_TAG. The primary keeps the Builds identity checks.
This is an adaptation of current Wrangler behavior, not a documented guarantee
of multi-Worker deployment through the Deploy button. Wrangler is pinned.

The separate probe.mjs has already verified live deployments, service bindings,
DO provisioning, promotion, and routing rollback with existing sockets open,
using local credentials and simulated Builds targeting variables. That does
not establish the permissions or behavior of an actual Deploy-button build.

This template is not the finished gateway architecture. A production version
still needs release locking, immutable-artifact validation, shared quota/data
bindings, admission tickets, safe migrations, accounting recovery retention,
old-release cleanup, and integration with existing deploy/update commands.
