# DORKS Found mint

The site claims up to three random Found Caps at 0 NEAR for the player. The wallet signs a NEP-413 message. The Node service checks the signature and the wallet's full-access public key, then calls the NEAR contract with the project sponsor key. The contract has a fixed supply of 1,024 and records up to three minted caps per account. The claim page reads current ownership from NEAR and **Use in game** selects the corresponding in-game design. The existing guest game remains open to guests.

## Local preview

With Node 22.22.2 or later, run `npm ci`, `npm run build`, then `node server.mjs`. Open `/mint` on the port printed by the server. The preview displays the closed-drop state until a contract and sponsor are configured.

## Hosting

1. Import the GitHub repository into Netlify. The build publishes the Found countdown at `/` and `/mint`, and the game at `/play`. A successful wallet claim opens the game lobby with a claimed design equipped. Bot practice works before the API is connected. Online matchmaking needs the API proxy.
2. Add `dorksplay.lol` as a custom domain in Netlify. Apply the DNS records shown in **Pending DNS verification** at Porkbun, then verify HTTPS.
3. Before claims open, deploy the Node service using `render.yaml`. Set `DORKS_SITE_ORIGIN` on Render to the exact public HTTPS origin. Set `DORKS_API_ORIGIN` on Netlify to the Render HTTPS origin without a trailing slash, then redeploy. The build will proxy `/api/*` to Render.
4. Set the confirmed launch date and Kyiv time in `src/found-launch.js`. Set the same time in the contract’s `opens_at_ms`. Both the API and the contract reject early claims. If using the optional `FOUND_OPENS_AT` server override, give it the same ISO 8601 timestamp with a timezone offset.
5. Verify `/api/found/status` on the Netlify site, including the intended NEAR network and contract. Run a wallet claim on testnet before enabling mainnet.


## Testnet setup

1. Create and fund a testnet contract account and a separate sponsor account. Build with `cargo build --locked --manifest-path contracts/found/Cargo.toml --target wasm32-unknown-unknown --release`. The Wasm is under `contracts/found/target/wasm32-unknown-unknown/release/`.
2. Deploy the Wasm to the contract account and call `new` as that same account with `sponsor_id`, `media_base_url`, and `opens_at_ms` (a JSON string with Unix milliseconds). Use a fresh account for this build, which adds a state field. Use a stable HTTPS origin that serves the published `/art/found/` files, without a trailing slash. Keep the art at those URLs after launch. NFTs point to their PNGs and the game renders the matching 3D models.
3. On the sponsor account, provision a function-call access key restricted to the contract's `claim` method, with a limited gas allowance. The sponsor needs spendable gas. The contract account separately needs funds for code and token storage. The claim call attaches 0 NEAR. The API checks the key on-chain before signing and rejects a full-access key, a broader scope, or a missing or exhausted gas allowance.
4. On Render set `NEAR_NETWORK=testnet`, `FOUND_CONTRACT_ID`, `FOUND_SPONSOR_ID`, `FOUND_SPONSOR_KEY`, and a random `FOUND_CHALLENGE_SECRET` of at least 32 characters. Render can generate the challenge secret from its blueprint. Keep both secrets server-side. `NEAR_RPC_URL` is optional. Set `FOUND_MINT_ENABLED=1` only on the environment where you intend to accept claims. Set `DORKS_SITE_ORIGIN` to that environment’s HTTPS origin.
5. Open the hosted claim page with a compatible testnet wallet, claim, check the three tokens in the wallet, and try **Use in game**. Repeat with the same account and check that the remaining count drops by three on the first claim and stays the same on retry. Transfer the token and verify the new owner's inventory. Record storage use and gas before sizing the mainnet funding.

The endpoint accepts Ed25519 full-access message signatures. The contract enforces a lifetime limit of three minted caps per NEAR account, so multiple accounts controlled by one person can claim separately. The current API serializes sponsored transactions in one process. Before opening an unrestricted public drop, choose a per-person distribution policy if needed and set a finite sponsor-key allowance.

## Friend transfers

From the Found page, connect a wallet, look up a friend's NEAR account and select **Request cap**. The requester signs an on-chain transaction with a refundable 0.01 NEAR storage deposit. Each cap can have one active request at a time. It expires after 24 hours. The current owner can refresh their inventory, approve the transfer or decline it. The requester can cancel. Closing a request returns its deposit. If the cap changed owners or the request expired, the current owner can close it and another request can replace it. Gas is paid by the wallets submitting those transactions.

Approval checks the exact request ID and current ownership on-chain before transferring the NFT. Verify that the previous owner loses the cap and the new owner sees it. The separate step of checking NFT ownership at entry to a Found match is pending.

## Before enabling mainnet

- Use a dedicated contract account and a dedicated sponsor account. Keep their full-access keys outside the hosting service. Protect the contract upgrade key with offline or multisig custody. Check the on-chain keys and deployed Wasm hash against the reviewed build before funding or opening claims.
- The mint uses an off-chain NEP-413 message. Verify in the wallet that minting sends no transaction, grants no approval, and attaches no funds from the player. Friend requests and approvals are separate, explicit transactions.
- On testnet, verify that a non-sponsor and a sponsor before the opening time cannot mint. After opening, check the three-cap cap across replays and transfers. Try approving as an unrelated account, approving an expired or replaced request, and refunding the same deposit twice. Record which account receives each refund.
- Exercise the sponsored claim with a restricted, finite-allowance key. Account limits cannot stop a compromised sponsor key or a wallet farm from allocating the remaining stock to different accounts. Give the sponsor only the gas budget needed for the drop and revoke the key after the drop.
