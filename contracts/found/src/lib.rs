use near_contract_standards::non_fungible_token::metadata::{
    NFTContractMetadata, NonFungibleTokenMetadataProvider, TokenMetadata, NFT_METADATA_SPEC,
};
use near_contract_standards::non_fungible_token::{NonFungibleToken, Token, TokenId};
use near_sdk::collections::{LazyOption, LookupMap};
use near_sdk::json_types::U64;
use near_sdk::{
    assert_one_yocto, env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault,
    Promise, PromiseOrValue,
};

const DESIGNS: [&str; 32] = [
    "Ember", "Moss", "Ripple", "Volt", "Sol", "Nox", "Boop", "Spud", "Frost", "Glitch", "Orbit",
    "Prism", "Pickle", "Snooze", "Toast", "Gloop", "Pebble", "Bloom", "Squirt", "Crumb", "Zappa",
    "Drizzle", "Cacto", "Shroom", "Pepper", "Bubba", "Munch", "Pixel", "Luna", "Aurora", "Midas",
    "Void",
];
const SUPPLY: u32 = 1024;
const CAPS_PER_CLAIM: u32 = 3;

#[derive(BorshStorageKey, near_sdk::borsh::BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    Tokens,
    Metadata,
    TokenMetadata,
    Enumeration,
    Approvals,
    LegacyClaims,
    Slots,
    ClaimBatches,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    tokens: NonFungibleToken,
    metadata: LazyOption<NFTContractMetadata>,
    sponsor_id: AccountId,
    claims: LookupMap<AccountId, Vec<TokenId>>,
    slots: LookupMap<u32, u32>,
    minted: u32,
    opens_at_ms: u64,
}

#[near]
impl Contract {
    #[init]
    pub fn new(sponsor_id: AccountId, media_base_url: String, opens_at_ms: U64) -> Self {
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "Contract account must initialize"
        );
        require!(
            media_base_url.starts_with("https://") && !media_base_url.ends_with('/'),
            "Use an HTTPS media base URL without trailing slash"
        );
        require!(sponsor_id != env::current_account_id(), "Use a separate sponsor account");
        require!(opens_at_ms.0 > 0, "Set a mint opening time");
        Self {
            tokens: NonFungibleToken::new(
                StorageKey::Tokens,
                env::current_account_id(),
                Some(StorageKey::TokenMetadata),
                Some(StorageKey::Enumeration),
                Some(StorageKey::Approvals),
            ),
            metadata: LazyOption::new(
                StorageKey::Metadata,
                Some(&NFTContractMetadata {
                    spec: NFT_METADATA_SPEC.into(),
                    name: "DORKS Found Caps".into(),
                    symbol: "FOUND".into(),
                    icon: None,
                    base_uri: Some(media_base_url),
                    reference: None,
                    reference_hash: None,
                }),
            ),
            sponsor_id,
            claims: LookupMap::new(StorageKey::ClaimBatches),
            slots: LookupMap::new(StorageKey::Slots),
            minted: 0,
            opens_at_ms: opens_at_ms.0,
        }
    }

    pub fn claim_status(&self, account_id: AccountId) -> Vec<TokenId> {
        if let Some(batch) = self.claims.get(&account_id) {
            return batch;
        }
        let legacy: LookupMap<AccountId, TokenId> = LookupMap::new(StorageKey::LegacyClaims);
        legacy.get(&account_id).into_iter().collect()
    }

    pub fn remaining(&self) -> u32 {
        SUPPLY - self.minted
    }

    pub fn claim(&mut self, receiver_id: AccountId) -> Vec<TokenId> {
        require!(
            env::predecessor_account_id() == self.sponsor_id,
            "Only the DORKS sponsor can mint"
        );
        require!(env::block_timestamp_ms() >= self.opens_at_ms, "The Found drop is not open yet");
        let mut batch = self.claim_status(receiver_id.clone());
        let unclaimed = CAPS_PER_CLAIM.saturating_sub(batch.len() as u32);
        let count = unclaimed.min(self.remaining());
        require!(count > 0 || !batch.is_empty(), "All Found caps have been claimed");
        if count == 0 {
            return batch;
        }

        let mut seed = env::random_seed_array();
        for _ in 0..count {
            batch.push(self.draw_cap(&receiver_id, &seed));
            seed = env::sha256_array(&seed);
        }
        self.claims.insert(&receiver_id, &batch);
        batch
    }

    // Draw without replacement from a pool of 32 copies of each design.
    fn draw_cap(&mut self, receiver_id: &AccountId, seed: &[u8; 32]) -> TokenId {
        let remaining = self.remaining();
        let index =
            (u64::from_le_bytes(seed[..8].try_into().unwrap()) % u64::from(remaining)) as u32;
        let last = remaining - 1;
        let slot = self.slots.get(&index).unwrap_or(index);
        let last_slot = self.slots.remove(&last).unwrap_or(last);
        if index != last {
            self.slots.insert(&index, &last_slot);
        }
        let design = slot as usize % DESIGNS.len();
        let token_id = format!(
            "found-{:02}-{:02}",
            design + 1,
            slot as usize / DESIGNS.len() + 1
        );
        let token = self.tokens.internal_mint_with_refund(
            token_id.clone(),
            receiver_id.clone(),
            Some(TokenMetadata {
                title: Some(format!("Found {}", DESIGNS[design])),
                description: Some("A scuffed DORKS cap you can equip in the game.".into()),
                media: Some(format!("art/found/{}-front.png", design + 1)),
                copies: Some(32),
                ..TokenMetadata::default()
            }),
            None,
        );
        near_contract_standards::non_fungible_token::events::NftMint {
            owner_id: &token.owner_id,
            token_ids: &[&token.token_id],
            memo: None,
        }
        .emit();
        self.minted += 1;
        token_id
    }
}

near_contract_standards::impl_non_fungible_token_core!(Contract, tokens);
near_contract_standards::impl_non_fungible_token_approval!(Contract, tokens);
near_contract_standards::impl_non_fungible_token_enumeration!(Contract, tokens);

#[near]
impl NonFungibleTokenMetadataProvider for Contract {
    fn nft_metadata(&self) -> NFTContractMetadata {
        self.metadata.get().unwrap()
    }
}

const REQUEST_DEPOSIT: NearToken = NearToken::from_millinear(10);
const REQUEST_LIFETIME_MS: u64 = 24 * 60 * 60 * 1000;
const REQUEST_SEQUENCE_KEY: &[u8] = b"dorks:transfer:sequence";

#[near(serializers = [borsh, json])]
pub struct TransferRequest {
    pub request_id: U64,
    pub requester_id: AccountId,
    pub owner_id: AccountId,
    pub expires_at_ms: u64,
}

fn transfer_request_store() -> LookupMap<TokenId, TransferRequest> {
    LookupMap::new(b"dorks:transfer:request".to_vec())
}

fn refund_request(request: TransferRequest) {
    Promise::new(request.requester_id).transfer(REQUEST_DEPOSIT);
}

#[near]
impl Contract {
    pub fn transfer_requests(&self, token_ids: Vec<TokenId>) -> Vec<Option<TransferRequest>> {
        require!(token_ids.len() <= 64, "Too many tokens");
        let requests = transfer_request_store();
        token_ids
            .iter()
            .map(|token_id| requests.get(token_id))
            .collect()
    }

    #[payable]
    pub fn request_transfer(&mut self, token_id: TokenId, owner_id: AccountId) {
        require!(
            env::attached_deposit() == REQUEST_DEPOSIT,
            "Attach 0.01 NEAR refundable deposit"
        );
        let requester_id = env::predecessor_account_id();
        require!(requester_id != owner_id, "You already own this cap");
        require!(
            self.tokens.owner_by_id.get(&token_id) == Some(owner_id.clone()),
            "The cap changed owners"
        );

        let mut requests = transfer_request_store();
        if let Some(previous) = requests.get(&token_id) {
            require!(
                previous.owner_id != owner_id
                    || previous.expires_at_ms <= env::block_timestamp_ms(),
                "This cap already has a pending request"
            );
            refund_request(previous);
        }

        let previous_id = env::storage_read(REQUEST_SEQUENCE_KEY)
            .map(|bytes| u64::from_le_bytes(bytes.try_into().unwrap()))
            .unwrap_or(0);
        let request_id = previous_id
            .checked_add(1)
            .expect("Request sequence exhausted");
        env::storage_write(REQUEST_SEQUENCE_KEY, &request_id.to_le_bytes());
        requests.insert(
            &token_id,
            &TransferRequest {
                request_id: U64(request_id),
                requester_id,
                owner_id,
                expires_at_ms: env::block_timestamp_ms() + REQUEST_LIFETIME_MS,
            },
        );
    }

    #[payable]
    pub fn resolve_transfer(&mut self, token_id: TokenId, request_id: U64, accept: bool) {
        assert_one_yocto();
        let mut requests = transfer_request_store();
        let request = requests.get(&token_id).expect("No pending request");
        require!(request.request_id == request_id, "This request has changed");
        let caller = env::predecessor_account_id();
        let owner = self.tokens.owner_by_id.get(&token_id);
        let active = request.expires_at_ms > env::block_timestamp_ms()
            && owner.as_ref() == Some(&request.owner_id);
        if accept {
            require!(
                active && caller == request.owner_id,
                "Only the current owner can approve an active request"
            );
            self.tokens.nft_transfer(
                request.requester_id.clone(),
                token_id.clone(),
                None,
                Some("DORKS friend request".into()),
            );
        } else {
            require!(
                caller == request.requester_id || owner.as_ref() == Some(&caller),
                "Only the requester or current owner can close a request"
            );
        }
        requests.remove(&token_id);
        refund_request(request);
    }
}
