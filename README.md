# Independent public patron record

## Current status — checked 4 October 2026

This repository exists and preserves the **sealed gathering of 10 wallets** for *Answering Circles; or, Networked Circles — Hors-Série: Full Field*, Ethereum token **23** in collection `0x73bf0861d91411ee053c7365772394d1e86a71c0`.

The record was sealed at **2026-10-02T23:51:35.929Z**, through block **26107941**. Its head and page digests remain unchanged by this documentation update.

- [Public record head](https://averylake.github.io/networked-circles-record/full-field-v1.json) and [first page](https://averylake.github.io/networked-circles-record/full-field-v1/page-0.json)
- [Live companion](https://networkedcircles.averylake.art/)
- [Source repository](https://github.com/averylake/networked-circles) (private; access required), with a proposed Presences verification archive and reusable release checklist
- Minted artifact: `ipfs://QmTJ2Ayee6fudVEqj4QMCFkG85xbfV2W34GFwgLNmvjsGK`
- [Presences gifts on Networked](https://networked.art/averylake/answering-circles-presences) and [verified ERC721 source](https://etherscan.io/address/0x8b6fd450e120a5c8c9e50ff0ff6f136194f60b86#code)

Presences is a later collection of ten personal views gifted to the original participating wallets. It does not modify the original roster or reopen its patron window. The record is about qualifying wallets, not proof of unique human identities.

`release-config.json` here is bound to token 23, mint block 26100149 and the minted artifact. The artwork source's root configuration intentionally retains its mint-time unbound state; the two files have distinct purposes.

The workflow is scheduled every 20 minutes on `main`. Once sealed, its scripts preserve the stored record rather than querying a new roster. This PR does not change the workflow, schedule, configuration or records. A future handover should inspect workflow health and compare served bytes; existence of a checked-in record alone does not guarantee continuing hosting.

Only the public JSON is deployed to Pages. No private credentials or correspondence belong in this repository. Historical setup/recovery instructions follow; their old “not yet created” status has been superseded.

## Historical setup and recovery procedure

1. For recovery into a new approved destination, create the dedicated public repository on its `main` branch. Copy this entire folder, including `.github`, into its root. Do not copy artwork source, secrets or private files. The configuration starts with tokenId, artifactURI and mintBlock unset.
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
