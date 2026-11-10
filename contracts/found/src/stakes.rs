use super::{env, near, require, AccountId, Contract, ContractExt, LookupMap, TokenId, U64};
use near_contract_standards::non_fungible_token::refund_approved_account_ids;

const ARBITER: &[u8] = b"stake-arbiter-v1";
const SEQUENCE: &[u8] = b"stake-sequence-v1";
const STAKE_WINDOW_MS: u64 = 120_000;
const MATCH_WINDOW_MS: u64 = 600_000;

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct StakeEntry {
    pub player: AccountId,
    pub token_id: TokenId,
    pub locked: bool,
}

#[near(serializers = [borsh, json])]
pub struct StakedMatch {
    pub entries: [StakeEntry; 2],
    pub deadline_ms: U64,
}

fn matches() -> LookupMap<u64, StakedMatch> {
    LookupMap::new(b"staked-matches-v1".to_vec())
}

fn arbiter() -> Option<AccountId> {
    env::storage_read(ARBITER)
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .and_then(|account| account.parse().ok())
}

fn require_arbiter() {
    require!(
        arbiter().as_ref() == Some(&env::predecessor_account_id()),
        "Only the match arbiter may do this"
    );
}

#[near]
impl Contract {
    pub fn set_stake_arbiter(&self, account_id: AccountId) {
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "Only the contract account may set the arbiter"
        );
        require!(
            account_id != self.sponsor_id && account_id != env::current_account_id(),
            "Use a dedicated arbiter account"
        );
        env::storage_write(ARBITER, account_id.as_bytes());
    }

    pub fn open_staked_match(&self, players: [AccountId; 2], tokens: [TokenId; 2]) -> U64 {
        require_arbiter();
        require!(
            players[0] != players[1] && tokens[0] != tokens[1],
            "Two distinct owners and caps are required"
        );
        let custody = env::current_account_id();
        let entries = std::array::from_fn(|i| {
            let player = &players[i];
            let token_id = &tokens[i];
            require!(
                player != &custody
                    && self.tokens.owner_by_id.get(token_id).as_ref() == Some(player),
                "A listed player no longer owns this cap"
            );
            StakeEntry {
                player: player.clone(),
                token_id: token_id.clone(),
                locked: false,
            }
        });
        let next = env::storage_read(SEQUENCE)
            .map(|value| u64::from_le_bytes(value.try_into().unwrap()))
            .unwrap_or(0)
            .checked_add(1)
            .expect("Match sequence exhausted");
        env::storage_write(SEQUENCE, &next.to_le_bytes());
        matches().insert(
            &next,
            &StakedMatch {
                entries,
                deadline_ms: U64(env::block_timestamp_ms() + STAKE_WINDOW_MS),
            },
        );
        U64(next)
    }

    pub fn get_staked_match(&self, match_id: U64) -> Option<StakedMatch> {
        matches().get(&match_id.0)
    }

    #[payable]
    pub fn lock_match_cap(&mut self, match_id: U64, token_id: TokenId) {
        near_sdk::assert_one_yocto();
        let mut store = matches();
        let mut game = store.get(&match_id.0).expect("Unknown match");
        let now = env::block_timestamp_ms();
        require!(now < game.deadline_ms.0, "Stake deadline expired");
        let caller = env::predecessor_account_id();
        let entry = game
            .entries
            .iter_mut()
            .find(|entry| entry.player == caller && entry.token_id == token_id)
            .expect("This cap is not your stake");
        require!(
            !entry.locked && self.tokens.owner_by_id.get(&token_id).as_ref() == Some(&caller),
            "Only the cap owner can lock it once"
        );
        self.move_match_cap(
            &caller,
            &env::current_account_id(),
            &token_id,
            "DORKS match stake",
        );
        entry.locked = true;
        if game.entries.iter().all(|entry| entry.locked) {
            game.deadline_ms = U64(now + MATCH_WINDOW_MS);
        }
        store.insert(&match_id.0, &game);
    }

    pub fn settle_staked_match(&mut self, match_id: U64, winner: AccountId) {
        require_arbiter();
        let mut store = matches();
        let game = store.get(&match_id.0).expect("Unknown match");
        require!(
            env::block_timestamp_ms() < game.deadline_ms.0,
            "Match expired"
        );
        require!(
            game.entries.iter().all(|entry| entry.locked),
            "Both caps must be locked"
        );
        require!(
            game.entries.iter().any(|entry| entry.player == winner),
            "Winner must be one of the players"
        );
        let custody = env::current_account_id();
        for entry in &game.entries {
            self.move_match_cap(&custody, &winner, &entry.token_id, "DORKS match payout");
        }
        store.remove(&match_id.0);
    }

    pub fn refund_staked_match(&mut self, match_id: U64) {
        let mut store = matches();
        let game = store.get(&match_id.0).expect("Unknown match");
        require!(
            env::block_timestamp_ms() >= game.deadline_ms.0,
            "Match is still active"
        );
        let custody = env::current_account_id();
        for entry in game.entries.iter().filter(|entry| entry.locked) {
            self.move_match_cap(
                &custody,
                &entry.player,
                &entry.token_id,
                "DORKS expired match refund",
            );
        }
        store.remove(&match_id.0);
    }
}

impl Contract {
    fn move_match_cap(&mut self, from: &AccountId, to: &AccountId, token_id: &TokenId, memo: &str) {
        require!(
            self.tokens.owner_by_id.get(token_id).as_ref() == Some(from),
            "Unexpected stake owner"
        );
        let (old_owner, approvals) =
            self.tokens
                .internal_transfer(from, to, token_id, None, Some(memo.into()));
        if let Some(approvals) = approvals {
            // Avoid creating a zero-value receipt for the contract on payout.
            if !approvals.is_empty() {
                refund_approved_account_ids(old_owner, &approvals);
            }
        }
    }
}
