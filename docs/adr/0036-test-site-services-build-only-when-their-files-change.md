# Test-site services build only when their files change

Each test-site service in `render.yaml` has a `buildFilter`, the files it's built from, and deploys only when one of them changed, so a docs- or tests-only change deploys nothing. When it deploys, once a night rather than per push, is ADR-0037's. Render's build minutes are capped, and the user said on 2026-11-27: "we're not production yet so i do not want to increase the billing plan at this time. we have to optimize build minutes wherever we can."

This rules out **building every service on every deploy** and **a paid build-minutes plan before production**. Production keeps no filter, as its services never auto-deploy.
