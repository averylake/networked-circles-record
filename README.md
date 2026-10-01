# Independent public patron record, R2.4

Prepared locally. This template has NOT created a repository, deployed Pages or verified a live backup. No RPC key, wallet or paid plan is required by this code. No new Netlify service is required.

Expected dedicated public repository: `averylake/networked-circles-record`.
Expected record: `https://averylake.github.io/networked-circles-record/full-field-v1.json` (head) with pages at `https://averylake.github.io/networked-circles-record/full-field-v1/page-<n>.json`, 1,000 patrons each. `store.mjs` keeps the repository in exactly this layout; `verify-published.mjs` checks the head and every page byte for byte.
The exact address is embedded in the unminted artwork. Confirm the account and path before minting; a different address requires rebuilding the HTML.

## Initial setup after publication approval

1. Create the dedicated public repository on its `main` branch. Copy this entire folder, including `.github`, into its root. Do not copy artwork source, secrets or private files. The configuration starts with tokenId, artifactURI and mintBlock unset.
2. In Settings > Pages, choose **GitHub Actions**, not deployment from a branch. Permit this workflow to write contents and deploy Pages. Configure the `github-pages` environment to allow the main branch. Required approvals on every deployment would prevent unattended updates.
3. Run “Preserve and publish public patron record” manually. It validates the service record, commits it, uploads only the public JSON and `.nojekyll`, explicitly deploys Pages, then checks the exact served bytes and `Access-Control-Allow-Origin: *` with Origin null. A failed fetch, commit, deploy, CORS check or byte comparison fails the job visibly.
4. Open the public JSON URL and test it in the release HTML's opaque sandbox. A green local test is not proof of a deployed backup. Run the production release gate only after both primary and backup pass.

## After mint, before listing

Apply the verified mint receipt binding to the Worker first. Then copy the corresponding bound configuration (tokenId, mintBlock, artifactURI) to this mirror's `release-config.json`. Keep the artwork's own configuration unbound; it was fixed at mint.

A configuration commit on main runs the workflow automatically. A pristine unbound snapshot may migrate once to that exact token and media URI. Wrong artwork, different token, simulated records, stale input, shrinking/reordered rosters and backward confirmed blocks are rejected. A bound incoming record is refused until the mirror configuration is explicitly bound. Verify the served waiting record before listing.

## During and after the auction

- Schedule: every 20 minutes, subject to GitHub scheduling delays. This is asynchronous preservation, not real-time failover. Watch failed runs and perform a manual run immediately before listing.
- The mirror retains confirmed-block progress even when no wallet was added.
- Before sealing, a heartbeat is committed if the last commit is older than 30 days, reducing the risk of GitHub's inactivity timeout. This is not a substitute for monitoring scheduler health.
- Once sealed, the record is immutable to this script and no further primary request is made. The workflow can redeploy and verify the retained file. After independent verification, the engineer can disable the schedule to avoid unnecessary runs while leaving Pages published.
- Replay final chain membership independently and compare the sealed JSON. Preserve offline copies and optionally pin it to IPFS. A later IPFS copy is preservation, not a new URL automatically added to the minted file.
- An outage before any successful copy cannot be repaired by this mirror. Structural checks and continuity are not cryptographic proof against a compromised primary. Preserve account access and independently verify the final roster.

## Workflow dependencies

Official Actions are pinned to the version hashes read on 30 September 2026. `GITHUB_TOKEN` is scoped to this repository with contents/write, pages/write and id-token/write. No long-lived personal access token or Alchemy secret is needed. The token's commits do not trigger Pages automatically, so the workflow includes configure-pages, upload-pages-artifact and deploy-pages explicitly.

References:
- https://docs.github.com/en/actions/concepts/security/github_token
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

Local regression tests are in the full source package's `tests/mirror.test.mjs` and use disposable local repositories and fake network responses. They do not deploy this workflow.
