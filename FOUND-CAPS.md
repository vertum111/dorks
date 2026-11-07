# DORKS Found Caps

**Found** is the starter rarity, below Common. Each of the 32 original designs has a matte, scratched, dirt-stained edition with its own worn front and back. A Found Prism is Found, even though the clean Prism is Legendary. Throw rules and odds are shared across all rarities.

## Try the local edition

Run `npm ci && npm test && npm run build`, then `node server.mjs`. Open the URL printed in the terminal. Choose **My dorks → Rarity → Found**. The arrows and thumbnails stay in the selected rarity. Click or drag the large cap to see the back. Select **Use** and start **Bot practice**. For a player match, open two independent browser sessions, equip a Found cap in each, choose **Find a dork** and ready up. Found and regular caps use separate queues. All 32 Found designs are available to try in the local game. The local gallery and match results do not represent wallet ownership.

The 64 face textures are in `public/art/found/`. Regenerate from the original assets with `node scripts/generate-found-caps.mjs` from the project directory (ImageMagick 7 and CairoSVG required for regeneration only).

## Proposed free drop

- Launch **DORKS: Found Caps** as a starter drop. Trial allocation: 1,024 tokens, 32 editions of each of 32 designs, one initial claim per NEAR account. Keep this pool separate from the existing collector pool. Assign from remaining stock, using a reviewed allocation scheme before promising fairness. Store stable design IDs independently of unique token IDs.
- Preferred player flow: claim through HOT Craft, connect the same NEAR wallet to DORKS, see the owned cap in the stash, equip it and join the Found queue. Keep local guest practice available. Confirm with HOT Craft whether it supports this project's zero-price drop, random allocation, per-account caps and sponsor-paid fees. Its published free campaigns establish a precedent, but do not establish those settings as self-serve features.
- Hackathon fallback: on NEAR testnet, a funded project account issues a starter to a verified recipient after a wallet challenge. The project pays network gas and NFT storage. Limit one initial claim per wallet in the contract, cap total supply, rate-limit the claim endpoint, and use an idempotent wallet claim so retries cannot mint twice. One wallet per claim is not proof of one person.
- Use NEP-171 ownership, NEP-177 metadata and owner enumeration. Store a PNG preview and an immutable metadata reference with the stable design ID and GLB link. DORKS can show the interactive cap even in wallets and marketplaces that only display the PNG. Treat the NEAR contract and token ID as the identity, and verify current ownership when equipping and joining the NFT queue. Validate that transferring a cap removes access from the former owner and grants it to the new owner. Match results are off-chain for the prototype.
- Verify one complete path on testnet: claim, transaction finalized, wallet inventory updated, cap equipped, match played. Publish contract ID, explorer transaction and exact reproduction steps. Testnet is the proposed demo environment; the prize address in the submission is a mainnet account.

## Submission

Primary track: **NFTs That Do Something**. Demonstrate that holding the NFT gives access to equip a particular 3D cap in the wallet-backed Found queue. A rendered collectible and browser-only collection are not evidence of that flow. The account-bearing NFT in the track prompt is an example. **Games With Real Economies** is a possible second track after demonstrating a meaningful economy tied to the game loop. The current project has no memecoin.

Required by the organizers: public source repository, working prototype, reproducible README, public X demo post with video or screenshots and `@NEARProtocol #NEARHackathon`, and the submission form with both links, project and team details, email, short description, track and mainnet payout address. Website field is optional. Deadline: 14 November 2026, 23:59 UTC. No keys or credentials in the repository or its history.

Sources: [official hackathon](https://nearhackathon.com/), [submission checklist](https://github.com/nearai/near-hackathon-prompt-examples/blob/main/SUBMITTING.md), [NFT track](https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/10-nfts.md), [NEAR NFT standard](https://docs.near.org/primitives/nft/standard), [HOT Craft campaign precedent](https://t.me/s/hotonnear/922).
