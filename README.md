# DORKS

DORKS is a browser game about playground cap battles. **Found Caps** are NEAR NFTs, and owning one gets you into the Found table. The game server checks on-chain who owns each cap before every round. When you pass a cap to a friend, the right to play it goes with it.

Built for **NEAR HACKATHON 2026** · Track: **NFTs That Do Something** (`nfts`).

- Play: https://dorksplay.lol/
- Mint (free, up to 3 per wallet): https://dorksplay.lol/mint
- Contract (NEAR mainnet): [`vertumion-hot2.tg`](https://nearblocks.io/address/vertumion-hot2.tg) · [deployment tx](https://nearblocks.io/txns/8CEKVpmiEDE8Xk7K5emDATE2gxuvvPGja2TV4eq7FJRx)
- Live supply: https://dorksplay.lol/api/found/status

## What the NFT does

| Without the NFT | Holding a Found Cap |
|---|---|
| Guest play: Bot practice and the regular online queue | Entry to the **Found queue**, where Found Caps only play other Found Caps |
| Nothing in your collection | The cap appears in **My dorks** as a playable 3D cap, matched to its token ID |
| — | **Pass a cap to a friend**: the friend sends a request on-chain, you approve it, and the token moves. Their table pass moves with it |

Ownership is enforced on the server as well as in the UI:

1. When you queue with a Found Cap, the lobby asks for a free **NEP-413 table pass** signature. That signature binds your NEAR account to this game session. It is not a transaction and costs no gas.
2. The server checks the signature and checks that the key is a full-access key of that account. Then it calls `nft_token` on the contract and confirms that you own the token and that it matches the equipped design.
3. The check runs **again before each round and each rematch**. If the cap changes owner mid-session, the old owner is removed from the table.

See [`found-ownership.mjs`](found-ownership.mjs) and the tests in [`tests/ownership.test.js`](tests/ownership.test.js). They cover forged signatures, sessions borrowing another session's proof, the wrong token for a design, and a transfer mid-session.

## Try it (judges)

1. Open the game lobby and select **Mint Found Caps** → drag the cap to spin it and press **Flip cap**. You see the scuffed back of the edition. No wallet is needed.
2. Open the game lobby → **Practice with Bot** → hold the yellow **Hold to aim** button and release inside the striped target. The caps flip, and a tie goes to a 5-second rock-paper-scissors.
3. On **/mint**, connect a NEAR mainnet wallet → **Claim Found Caps** → sign the message. The sponsor pays the gas and you get up to 3 random Found Caps. The game opens with one of them selected.
4. In the game → **My dorks** shows the caps your wallet holds right now → equip a cap → **Find a dork** → sign the table pass. You are now in the Found queue. To see a match, open a second browser profile with another wallet that holds a cap.
5. Transfer: on **/mint**, under **Pass a cap to a friend**, wallet B finds wallet A and sends **Request cap** (0.01 NEAR refundable deposit). Wallet A chooses **Approve & send**. Refresh both. The cap now shows in B's collection, and A can no longer queue with it.

## Run from source

Node.js 22.22.2+.

```sh
npm ci
npm test        # 80 tests: rules, timing, hand/cap geometry, matchmaking, NFT ownership gate
npm run build
node server.mjs # http://127.0.0.1:4173/
```

Local runs need no keys. You get Bot practice and the regular online queue. To try matchmaking, open two independent browser sessions and choose **Find a dork** in both. The Found queue and wallet features need a contract. See [MINT-DEPLOY.md](MINT-DEPLOY.md) for testnet setup.

## How NEAR is used

- [`contracts/found/src/lib.rs`](contracts/found/src/lib.rs) is a Rust NEP-171/177/181 contract. It has a fixed supply of 1,024 (32 designs × 32 editions) and draws without replacement from the remaining stock. Each account can claim at most 3 caps. Transfers are consent-based (`request_transfer` / `resolve_transfer` with a refundable deposit and a 24-hour expiry).
- [`found-api.mjs`](found-api.mjs) handles the sponsored claim. It verifies the NEP-413 claim message, and the sponsor key is restricted to the `claim` method with a finite allowance.
- [`found-ownership.mjs`](found-ownership.mjs) + [`match-server.mjs`](match-server.mjs) gate the Found queue by on-chain ownership.
- [`src/game-wallet.js`](src/game-wallet.js) reads `nft_tokens_for_owner` through HOT `near-connect` and maps each token to its 3D cap.

Casual matches and bot practice award points only. They never move NFTs.

### Stake matches

A separate stakes lobby lets two players each lock one specific Found Cap before the round. The contract transfers both caps to the winner once, without asking the loser to sign again. A player who leaves a live match or runs out of throw time forfeits. If the match expires without a settled result, anyone can trigger a refund to the original owners. The game calculates throw accuracy from the server's charge and release timestamps.

The escrow lives in `contracts/found/src/stakes.rs`. The match server is the trusted arbiter and submits the winner to NEAR. The lobby publishes the result after that transaction is final. A fresh server discovers pending payouts from the contract. Paying an already settled match is a no-op. Anyone can trigger a payout, and only the recorded winner can receive the caps. A game that stops before NEAR records a winner expires and refunds the original owners.

The server's NEAR key is limited to `open_staked_match`, `record_staked_winner` and `pay_staked_winner`. Unsetting `FOUND_STAKES_ENABLED` stops new tables while leaving recovery active for a configured arbiter. Mainnet opens only after explicit configuration and verification of the contract's arbiter and the scoped access key.

For an isolated testnet backend, set `NEAR_NETWORK=testnet`, `FOUND_STAKES_ENABLED=true`, and the testnet `FOUND_CONTRACT_ID`, `FOUND_STAKE_ARBITER_ID` and `FOUND_STAKE_ARBITER_KEY`. Initialize the arbiter from the testnet contract account with `set_stake_arbiter`. To recover from a different browser after expiry, call `refund_staked_match` with the match ID from your lock transaction. Build the candidate WASM from source with `cargo build --manifest-path contracts/found/Cargo.toml --locked --target wasm32-unknown-unknown --release`. The checked-in WASM is the existing mint release. The smoke script takes a testnet credentials file and the candidate WASM path. It exercises the contract directly by default and the two-wallet HTTP match with `--lobby`, including a hard server restart after the verdict and before payout.

## Assets and credits

- Dragon art, Found textures and emote stickers were generated with an AI image tool from our own art direction.
- 3D hands: [WebXR generic-hand](https://github.com/immersive-web/webxr-input-profiles) (MIT), see `public/models/webxr-hand/`.
- Fonts: Freckle Face, Pangolin and Dokdo (SIL OFL), with licenses in `public/fonts/`.
- Reaction sound clips are third-party meme sounds. Each clip's source is listed in `public/audio/memes/manifest.json`. They remain the property of their owners and are not covered by this repository's license.
- Three.js (MIT), near-api-js, @hot-labs/near-connect.

## License

Code: MIT, see [LICENSE](LICENSE). The third-party assets above keep their own licenses.

Separate hackathon project by the same builder: [Lunearcy](https://x.com/playlunearcy).
