# DORKS Found mint

The site claims a random Found Cap at 0 NEAR for the player. The wallet signs a NEP-413 message. The Node service checks the signature and the wallet's full-access public key, then calls the NEAR contract with the project sponsor key. The contract has a fixed supply of 1,024 and records one claim per account. The claim page reads current ownership from NEAR and **Use in game** selects the corresponding in-game design. The existing guest game remains open to guests.

## Local preview

With Node 22.22.2 or later, run `npm ci`, `npm run build`, then `node server.mjs`. Open `/mint` on the port printed by the server. The preview displays the closed-drop state until a contract and sponsor are configured.

## Hosting

1. Import the GitHub repository into Netlify. The build publishes the Found countdown page at `/` and `/mint`. It works before the API is connected.
2. Add `dorksplay.lol` as a custom domain in Netlify. Apply the DNS records shown in **Pending DNS verification** at Porkbun, then verify HTTPS.
3. Before claims open, deploy the Node service using `render.yaml`. Set `DORKS_SITE_ORIGIN` on Render to the exact public HTTPS origin. Set `DORKS_API_ORIGIN` on Netlify to the Render HTTPS origin without a trailing slash, then redeploy. The build will proxy `/api/*` to Render.
4. Set the confirmed launch date and Kyiv time in `src/found-launch.js`. The API rejects claims before that time. If using the optional `FOUND_OPENS_AT` server override, give it the same ISO 8601 timestamp with a timezone offset.
5. Verify `/api/found/status` on the Netlify site, including the intended NEAR network and contract. Run a wallet claim on testnet before enabling mainnet.


## Testnet setup

1. Create and fund a testnet contract account and a separate sponsor account. Build with `cargo build --locked --manifest-path contracts/found/Cargo.toml --target wasm32-unknown-unknown --release`. The Wasm is under `contracts/found/target/wasm32-unknown-unknown/release/`.
2. Deploy the Wasm to the contract account and call `new` as that same account with `sponsor_id` and `media_base_url`. Use a stable HTTPS origin that serves the published `/art/found/` files, without a trailing slash. Keep the art at those URLs after launch. NFTs point to their PNGs and the game renders the matching 3D models.
3. On the sponsor account, provision a function-call access key restricted to the contract's `claim` method, with a limited gas allowance. The sponsor needs spendable gas. The contract account separately needs funds for code and token storage. The claim call attaches 0 NEAR.
4. On Render set `NEAR_NETWORK=testnet`, `FOUND_CONTRACT_ID`, `FOUND_SPONSOR_ID`, `FOUND_SPONSOR_KEY`, and a random `FOUND_CHALLENGE_SECRET` of at least 32 characters. Render can generate the challenge secret from its blueprint. Keep both secrets server-side. `NEAR_RPC_URL` is optional.
5. Open the hosted claim page with a compatible testnet wallet, claim, check the token in the wallet, and try **Use in game**. Repeat with the same account and check that the remaining count drops only once. Transfer the token and verify the new owner's inventory. Record storage use and gas before sizing the mainnet funding.

The endpoint accepts Ed25519 full-access message signatures. The contract enforces one claim per NEAR account, so multiple accounts controlled by one person can claim separately. The current API serializes sponsored transactions in one process. Before opening an unrestricted public drop, choose a per-person distribution policy if needed and set a finite sponsor-key allowance.

## Friend transfers

From the Found page, connect a wallet, look up a friend's NEAR account and select **Request cap**. The requester signs an on-chain transaction with a refundable 0.01 NEAR storage deposit. Each cap can have one active request at a time. It expires after 24 hours. The current owner can refresh their inventory, approve the transfer or decline it. The requester can cancel. Closing a request returns its deposit. If the cap changed owners or the request expired, the current owner can close it and another request can replace it. Gas is paid by the wallets submitting those transactions.

Approval checks the exact request ID and current ownership on-chain before transferring the NFT. Verify that the previous owner loses the cap and the new owner sees it. The separate step of checking NFT ownership at entry to a Found match is pending.
