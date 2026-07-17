from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Literal, Set

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.blockchain.nft.chain_registry import DEFAULT_BADGE_CHAIN_ID, get_chain_config
from app.domains.blockchain.nft.nft_client_factory import NFTClientFactory
from app.models import BadgeTemplate, PendingBadgeGrant, User, UserBadge
from app.domains.mental_health.models import Conversation, JournalEntry, PlayerWellnessState
from app.schemas.user import EarnedBadgeInfo

logger = logging.getLogger(__name__)

# HACKATHON: Hardcoded dual-chain minting configuration.
# TODO: Replace with environment variable config (e.g., AUTOPILOT_MINT_CHAINS=97,656476,204)
# These chains will receive simultaneous badge mints when a user earns a badge.
# Currently: BSC Testnet only for BNB Chain hackathon
DUAL_MINT_CHAIN_IDS: list[int] = [97]  # BSC Testnet


LET_THERE_BE_BADGE_BADGE_ID = 1
TRIPLE_THREAT_OF_THOUGHTS_BADGE_ID = 2
SEVEN_DAYS_A_WEEK_BADGE_ID = 3
TWO_WEEKS_NOTICE_YOU_GAVE_TO_NEGATIVITY_BADGE_ID = 4
FULL_MOON_POSITIVITY_BADGE_ID = 5
QUARTER_CENTURY_OF_JOURNALING_BADGE_ID = 6
UNLEASH_THE_WORDS_BADGE_ID = 7
BESTIES_BADGE_ID = 8

AchievementAction = Literal[
    "manual_sync",
    "journal_saved",
    "quest_completed",
    "wellness_state_updated",
]


@dataclass(frozen=True)
class BadgeRule:
    badge_id: int
    reason: str
    trigger_actions: Set[AchievementAction]
    min_activity_days: int | None = None
    min_streak: int | None = None
    min_journal_count: int | None = None
    # Badge 7: longest single journal entry must reach this word count
    min_word_count: int | None = None
    # Badge 8: highest number of exchanges in any single conversation session
    min_chat_session_messages: int | None = None


DEFAULT_BADGE_RULES: tuple[BadgeRule, ...] = (
    BadgeRule(
        badge_id=LET_THERE_BE_BADGE_BADGE_ID,
        reason="First activity",
        trigger_actions={"manual_sync", "journal_saved", "quest_completed"},
        min_activity_days=1,
    ),
    BadgeRule(
        badge_id=TRIPLE_THREAT_OF_THOUGHTS_BADGE_ID,
        reason="3 days of activity",
        trigger_actions={"manual_sync", "journal_saved", "quest_completed"},
        min_activity_days=3,
    ),
    BadgeRule(
        badge_id=SEVEN_DAYS_A_WEEK_BADGE_ID,
        reason="7-day streak",
        trigger_actions={"manual_sync", "quest_completed", "wellness_state_updated"},
        min_streak=7,
    ),
    BadgeRule(
        badge_id=TWO_WEEKS_NOTICE_YOU_GAVE_TO_NEGATIVITY_BADGE_ID,
        reason="14-day streak",
        trigger_actions={"manual_sync", "quest_completed", "wellness_state_updated"},
        min_streak=14,
    ),
    BadgeRule(
        badge_id=FULL_MOON_POSITIVITY_BADGE_ID,
        reason="30-day streak",
        trigger_actions={"manual_sync", "quest_completed", "wellness_state_updated"},
        min_streak=30,
    ),
    BadgeRule(
        badge_id=QUARTER_CENTURY_OF_JOURNALING_BADGE_ID,
        reason="25 journal entries",
        trigger_actions={"manual_sync", "journal_saved"},
        min_journal_count=25,
    ),
    BadgeRule(
        badge_id=UNLEASH_THE_WORDS_BADGE_ID,
        reason="Journal entry longer than 500 words",
        trigger_actions={"manual_sync", "journal_saved"},
        min_word_count=500,
    ),
    BadgeRule(
        badge_id=BESTIES_BADGE_ID,
        reason="100 messages in a single chat session",
        # No real-time chat trigger exists yet; manual_sync provides the catch-up path.
        trigger_actions={"manual_sync"},
        min_chat_session_messages=100,
    ),
)


@dataclass(frozen=True)
class AchievementMetrics:
    current_streak: int
    journal_count: int
    total_activity_days: int
    # Highest word count across any single journal entry (for badge 7)
    max_entry_word_count: int
    # Highest exchange count in any single conversation session (for badge 8)
    max_chat_session_messages: int


async def _load_achievement_metrics(db: AsyncSession, user: User) -> AchievementMetrics:
    current_streak = int(getattr(user, "current_streak", 0) or 0)

    journal_count = (
        await db.execute(
            select(func.count(JournalEntry.id)).filter(JournalEntry.user_id == user.id)
        )
    ).scalar() or 0

    total_activity_days = (
        await db.execute(
            select(func.count(func.distinct(JournalEntry.entry_date))).filter(
                JournalEntry.user_id == user.id
            )
        )
    ).scalar() or 0

    wellness_streak = (
        await db.execute(
            select(PlayerWellnessState.current_streak).where(PlayerWellnessState.user_id == user.id)
        )
    ).scalar() or 0
    current_streak = max(current_streak, int(wellness_streak or 0))

    # Max word count across any single journal entry (badge 7 criterion)
    max_entry_word_count = (
        await db.execute(
            select(func.coalesce(func.max(JournalEntry.word_count), 0)).filter(
                JournalEntry.user_id == user.id
            )
        )
    ).scalar() or 0

    # Max exchanges in any single conversation session (badge 8 criterion).
    # Each Conversation row represents one user-assistant exchange, grouped by session_id.
    session_counts_sq = (
        select(func.count(Conversation.id).label("msg_count"))
        .filter(Conversation.user_id == user.id)
        .group_by(Conversation.session_id)
        .subquery()
    )
    max_chat_session_messages = (
        await db.execute(
            select(func.coalesce(func.max(session_counts_sq.c.msg_count), 0))
        )
    ).scalar() or 0

    return AchievementMetrics(
        current_streak=current_streak,
        journal_count=int(journal_count),
        total_activity_days=int(total_activity_days),
        max_entry_word_count=int(max_entry_word_count),
        max_chat_session_messages=int(max_chat_session_messages),
    )


def _qualifies(rule: BadgeRule, metrics: AchievementMetrics) -> bool:
    if rule.min_activity_days is not None and metrics.total_activity_days < rule.min_activity_days:
        return False
    if rule.min_streak is not None and metrics.current_streak < rule.min_streak:
        return False
    if rule.min_journal_count is not None and metrics.journal_count < rule.min_journal_count:
        return False
    if rule.min_word_count is not None and metrics.max_entry_word_count < rule.min_word_count:
        return False
    if rule.min_chat_session_messages is not None and metrics.max_chat_session_messages < rule.min_chat_session_messages:
        return False
    return True


def _rules_for_action(action: AchievementAction) -> List[BadgeRule]:
    return [rule for rule in DEFAULT_BADGE_RULES if action in rule.trigger_actions]


def _criteria_qualifies(criteria: Dict[str, Any], metrics: AchievementMetrics) -> bool:
    if not criteria:
        return False

    min_activity_days_raw = criteria.get("min_activity_days")
    min_streak_raw = criteria.get("min_streak")
    min_journal_count_raw = criteria.get("min_journal_count")

    min_activity_days = int(min_activity_days_raw) if min_activity_days_raw is not None else None
    min_streak = int(min_streak_raw) if min_streak_raw is not None else None
    min_journal_count = int(min_journal_count_raw) if min_journal_count_raw is not None else None

    if min_activity_days is not None and metrics.total_activity_days < min_activity_days:
        return False
    if min_streak is not None and metrics.current_streak < min_streak:
        return False
    if min_journal_count is not None and metrics.journal_count < min_journal_count:
        return False

    # Admin templates can also specify word-count or chat-session thresholds
    min_word_count_raw = criteria.get("min_word_count")
    min_chat_session_messages_raw = criteria.get("min_chat_session_messages")
    min_word_count = int(min_word_count_raw) if min_word_count_raw is not None else None
    min_chat_session_messages = int(min_chat_session_messages_raw) if min_chat_session_messages_raw is not None else None

    if min_word_count is not None and metrics.max_entry_word_count < min_word_count:
        return False
    if min_chat_session_messages is not None and metrics.max_chat_session_messages < min_chat_session_messages:
        return False

    return True


async def trigger_achievement_check(
    db: AsyncSession,
    user: User,
    *,
    action: AchievementAction,
    fail_on_config_error: bool = False,
) -> List[EarnedBadgeInfo]:
    """Evaluate and mint badges relevant to a specific user action."""
    candidate_rules = _rules_for_action(action)

    metrics = await _load_achievement_metrics(db, user)

    configured_dual_chains = [
        chain_id for chain_id in DUAL_MINT_CHAIN_IDS
        if (cfg := get_chain_config(chain_id)) and cfg.contract_address
    ]
    if not configured_dual_chains and fail_on_config_error and candidate_rules:
        message = f"No NFT contract addresses configured for DUAL_MINT_CHAIN_IDS: {DUAL_MINT_CHAIN_IDS}"
        raise RuntimeError(message)
    if not configured_dual_chains and candidate_rules:
        logger.warning(
            "No NFT contract addresses configured for DUAL_MINT_CHAIN_IDS %s. Skipping default rules for user %s action=%s",
            DUAL_MINT_CHAIN_IDS,
            user.id,
            action,
        )

    awarded_badges_res = await db.execute(
        select(UserBadge.badge_id, UserBadge.chain_id).filter(UserBadge.user_id == user.id)
    )
    awarded_badges: Set[tuple[int, int]] = {(int(row[0]), int(row[1])) for row in awarded_badges_res.all()}

    template_stmt = (
        select(BadgeTemplate)
        .where(
            BadgeTemplate.auto_award_enabled.is_(True),
            BadgeTemplate.status == "PUBLISHED",
            BadgeTemplate.auto_award_action == action,
        )
        .order_by(BadgeTemplate.created_at.asc())
    )
    admin_templates = list((await db.execute(template_stmt)).scalars().all())

    if not candidate_rules and not admin_templates:
        return []

    factory = NFTClientFactory()
    badges_to_add_to_db: List[Dict[str, Any]] = []
    # Collects pending grants for wallet-less users (written in same commit batch)
    pending_grants_to_add: List[Dict[str, Any]] = []

    async def attempt_mint(
        *,
        badge_id: int,
        reason: str,
    ) -> None:
        """Mint badge on all chains in DUAL_MINT_CHAIN_IDS. Saves successful mints to badges_to_add_to_db."""
        if not user.wallet_address:
            logger.info(
                "User %s qualifies for badge %s (%s) but has no linked wallet — recording pending grant",
                user.id,
                badge_id,
                reason,
            )
            # Store eligibility so the badge can be minted retroactively once
            # the user links their wallet via /api/v1/link-did.
            pending_grants_to_add.append(
                {"badge_id": badge_id, "reason": reason, "action": action}
            )
            return

        logger.info(
            "User %s qualifies for badge %s (%s) - attempting mint on %s chains",
            user.id,
            badge_id,
            reason,
            len(DUAL_MINT_CHAIN_IDS),
        )

        for chain_id in DUAL_MINT_CHAIN_IDS:
            cfg = get_chain_config(chain_id)
            if not cfg or not cfg.contract_address:
                logger.warning("Chain %s not configured for badge minting, skipping", chain_id)
                continue

            badge_key = (badge_id, chain_id)
            if badge_key in awarded_badges:
                logger.debug("User already has badge %s on chain %s, skipping", badge_id, chain_id)
                continue

            try:
                tx_hash = await factory.mint_badge(chain_id, user.wallet_address, badge_id)
                if tx_hash:
                    awarded_badges.add(badge_key)
                    badges_to_add_to_db.append({
                        "badge_id": badge_id,
                        "chain_id": chain_id,
                        "contract_address": cfg.contract_address,
                        "tx_hash": tx_hash,
                    })
                    logger.info(
                        "Badge %s minted successfully on chain %s for user %s (tx: %s)",
                        badge_id,
                        chain_id,
                        user.id,
                        tx_hash[:16] + "...",
                    )
                else:
                    logger.warning(
                        "Badge %s mint returned no tx_hash on chain %s for user %s",
                        badge_id,
                        chain_id,
                        user.id,
                    )
            except Exception as exc:
                logger.warning(
                    "Failed to mint badge %s on chain %s for user %s: %s. Continuing with other chains.",
                    badge_id,
                    chain_id,
                    user.id,
                    exc,
                )

    if configured_dual_chains:
        for rule in candidate_rules:
            if _qualifies(rule, metrics):
                await attempt_mint(
                    badge_id=rule.badge_id,
                    reason=rule.reason,
                )

    for template in admin_templates:
        criteria = template.auto_award_criteria or {}
        if not isinstance(criteria, dict):
            logger.warning(
                "Skipping auto-award template %s: criteria must be a JSON object.",
                template.id,
            )
            continue
        if not _criteria_qualifies(criteria, metrics):
            continue

        # Admin templates mint on their specified chain only (not dual-chain)
        template_chain_id = int(template.chain_id)
        template_cfg = get_chain_config(template_chain_id)
        if not template_cfg or not template_cfg.contract_address:
            logger.warning(
                "Admin template %s chain %s not configured, skipping",
                template.id,
                template_chain_id,
            )
            continue

        badge_key = (int(template.token_id), template_chain_id)
        if badge_key in awarded_badges:
            continue

        if not user.wallet_address:
            continue

        try:
            tx_hash = await factory.mint_badge(template_chain_id, user.wallet_address, int(template.token_id))
            if tx_hash:
                awarded_badges.add(badge_key)
                badges_to_add_to_db.append({
                    "badge_id": int(template.token_id),
                    "chain_id": template_chain_id,
                    "contract_address": template_cfg.contract_address,
                    "tx_hash": tx_hash,
                })
                logger.info(
                    "Admin template %s badge minted on chain %s for user %s",
                    template.id,
                    template_chain_id,
                    user.id,
                )
        except Exception as exc:
            logger.warning(
                "Failed to mint admin template %s badge on chain %s: %s",
                template.id,
                template_chain_id,
                exc,
            )

    if not badges_to_add_to_db and not pending_grants_to_add:
        return []

    current_time = datetime.now()
    newly_awarded_badges: List[EarnedBadgeInfo] = []
    for badge_info in badges_to_add_to_db:
        new_award = UserBadge(
            user_id=user.id,
            badge_id=badge_info["badge_id"],
            contract_address=badge_info["contract_address"],
            transaction_hash=badge_info["tx_hash"],
            chain_id=badge_info["chain_id"],
            awarded_at=current_time,
        )
        db.add(new_award)
        newly_awarded_badges.append(
            EarnedBadgeInfo(
                badge_id=badge_info["badge_id"],
                awarded_at=current_time,
                transaction_hash=badge_info["tx_hash"],
                contract_address=badge_info["contract_address"],
            )
        )

    # Persist pending grants so they survive until the user links a wallet.
    # ON CONFLICT DO NOTHING semantics: if a record already exists (user already
    # qualified before), the IntegrityError is caught below and we roll back cleanly.
    for grant_info in pending_grants_to_add:
        db.add(
            PendingBadgeGrant(
                user_id=user.id,
                badge_id=grant_info["badge_id"],
                reason=grant_info["reason"],
                action_context=grant_info.get("action"),
                qualified_at=current_time,
            )
        )

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        logger.info(
            "Concurrent badge insert detected for user %s; awards likely already persisted.",
            user.id,
        )
        return []
    except Exception:
        await db.rollback()
        raise

    logger.info(
        "Saved %s new badge awards for user %s (action=%s)",
        len(newly_awarded_badges),
        user.id,
        action,
    )
    return newly_awarded_badges


async def sync_user_achievements(
    db: AsyncSession,
    user: User,
    *,
    fail_on_config_error: bool = True,
) -> List[EarnedBadgeInfo]:
    """Manual sync path that evaluates all rule groups."""
    return await trigger_achievement_check(
        db,
        user,
        action="manual_sync",
        fail_on_config_error=fail_on_config_error,
    )


async def drain_pending_grants(db: AsyncSession, user: User) -> List[EarnedBadgeInfo]:
    """Retroactively mint all pending badge grants for a user who just linked their wallet.

    Called immediately after a successful wallet linkage so that any eligibility
    recorded while the user had no wallet is honoured without requiring manual sync.
    """
    if not user.wallet_address:
        return []

    grants_result = await db.execute(
        select(PendingBadgeGrant).where(PendingBadgeGrant.user_id == user.id)
    )
    grants = grants_result.scalars().all()

    if not grants:
        return []

    factory = NFTClientFactory()
    awarded_badges_res = await db.execute(
        select(UserBadge.badge_id, UserBadge.chain_id).filter(UserBadge.user_id == user.id)
    )
    awarded_badges: Set[tuple[int, int]] = {(int(r[0]), int(r[1])) for r in awarded_badges_res.all()}

    minted: List[EarnedBadgeInfo] = []
    now = datetime.now()

    for grant in grants:
        succeeded_on_any_chain = False
        for chain_id in DUAL_MINT_CHAIN_IDS:
            cfg = get_chain_config(chain_id)
            if not cfg or not cfg.contract_address:
                continue

            badge_key = (grant.badge_id, chain_id)
            if badge_key in awarded_badges:
                succeeded_on_any_chain = True
                continue

            try:
                tx_hash = await factory.mint_badge(chain_id, user.wallet_address, grant.badge_id)
                if tx_hash:
                    awarded_badges.add(badge_key)
                    db.add(
                        UserBadge(
                            user_id=user.id,
                            badge_id=grant.badge_id,
                            chain_id=chain_id,
                            contract_address=cfg.contract_address,
                            transaction_hash=tx_hash,
                            awarded_at=now,
                        )
                    )
                    minted.append(
                        EarnedBadgeInfo(
                            badge_id=grant.badge_id,
                            awarded_at=now,
                            transaction_hash=tx_hash,
                            contract_address=cfg.contract_address,
                        )
                    )
                    succeeded_on_any_chain = True
                    logger.info(
                        "Drained pending grant: badge %s minted on chain %s for user %s",
                        grant.badge_id,
                        chain_id,
                        user.id,
                    )
            except Exception as exc:
                logger.warning(
                    "Failed to drain pending grant badge %s on chain %s for user %s: %s",
                    grant.badge_id,
                    chain_id,
                    user.id,
                    exc,
                )

        # Delete the pending row only when at least one chain succeeded (or was already minted).
        if succeeded_on_any_chain:
            await db.delete(grant)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        logger.warning(
            "Integrity error during pending grant drain for user %s — badges may already exist.",
            user.id,
        )
    except Exception:
        await db.rollback()
        raise

    logger.info(
        "Drained %s pending badge grants for user %s",
        len(minted),
        user.id,
    )
    return minted
