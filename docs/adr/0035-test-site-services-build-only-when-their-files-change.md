# Test-site services build only when their files change

Each test-site service in `render.yaml` has a `buildFilter`: it deploys from `main` once CI passes only when the push changes a file it's built from, so a docs- or tests-only push deploys nothing. Render's build minutes are capped, and the user said on 2026-11-27: "we're not production yet so i do not want to increase the billing plan at this time. we have to optimize build minutes wherever we can."

This rules out **building every service on every push** and **a paid build-minutes plan before production**. It supersedes ADR-0020's "the test environment deploys from `main` once CI passes" for pushes that touch none of a service's files. Production keeps no filter, as its services never auto-deploy.
