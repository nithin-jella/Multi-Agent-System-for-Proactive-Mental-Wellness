from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import llm
from app.core.redaction import sanitize_text
from app.models import User  # Core model
from app.domains.mental_health.models import PlayerWellnessState, QuestInstance, QuestStatusEnum

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are Aika, a compassionate Indonesian mental wellness guide for UGM students. "
    "Offer short, empathetic encouragement in Bahasa Indonesia with warm tone, and avoid medical diagnoses."
)
_BANNED_PHRASES: tuple[str, ...] = (
    "bunuh diri",
    "kill yourself",
    "suicide",
    "harm yourself",
    "medicine",
    "diagnosis",
)
_MAX_MEMORY = 3
_DAILY_CACHE_KEY = "daily_check_in_cache"


def _build_prompt(
    user: User,
    completed: Sequence[QuestInstance],
    active: Sequence[QuestInstance],
    wellness_state: PlayerWellnessState,
    memory: Sequence[str],
) -> str:
    preferred_name = user.preferred_name or user.first_name or user.name or "teman"
    completed_text = ", ".join(q.template.name for q in completed if q.template) or "Belum ada"
    active_text = ", ".join(q.template.name for q in active if q.template) or "Tidak ada"
    streak_line = f"{wellness_state.current_streak} hari" if wellness_state.current_streak else "belum ada"
    memory_text = " | ".join(memory) if memory else "None"

    return (
        f"Nama panggilan: {preferred_name}.\n"
        f"Streak: {streak_line}.\n"
        f"Harmony score: {wellness_state.harmony_score:.2f}.\n"
        f"Quest selesai terbaru: {completed_text}.\n"
        f"Quest aktif: {active_text}.\n"
        f"Echo memory: {memory_text}.\n"
        "Tulis pesan singkat (maks 3 kalimat) untuk memotivasi dan memberi dukungan lembut."
    )


def _passes_guardrails(text: str) -> bool:
    lowered = text.lower()
    return not any(phrase in lowered for phrase in _BANNED_PHRASES)


def _utcnow() -> datetime:
    return datetime.utcnow()


def _to_iso(value: datetime) -> str:
    return value.replace(microsecond=0).isoformat()


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _next_utc_midnight(value: datetime) -> datetime:
    return value.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)


def _quest_signature(quests: Sequence[QuestInstance]) -> str:
    signatures: List[str] = []
    for quest in quests:
        status = quest.status.value if hasattr(quest.status, "value") else str(quest.status)
        anchor_dt = quest.completed_at or quest.issued_at
        anchor = anchor_dt.date().isoformat() if anchor_dt else "none"
        template_name = quest.template.name if quest.template else "unknown"
        signatures.append(f"{quest.id}:{status}:{template_name}:{anchor}")
    return "|".join(signatures)


def _build_daily_cache_fingerprint(
    now: datetime,
    wellness_state: PlayerWellnessState,
    recent_quests: Sequence[QuestInstance],
) -> str:
    today = now.date().isoformat()
    score = round(float(wellness_state.harmony_score), 2)
    joy = round(float(wellness_state.joy_balance), 2)
    compassion = "1" if wellness_state.compassion_mode_active else "0"
    quests = _quest_signature(recent_quests)
    return f"{today}:{wellness_state.current_streak}:{score}:{joy}:{compassion}:{quests}"


def _llm_is_available() -> bool:
    generate_response = getattr(llm, "generate_response", None)
    if not callable(generate_response):
        return False

    configured_keys = getattr(llm, "GEMINI_API_KEYS", None)
    if isinstance(configured_keys, list) and bool(configured_keys):
        return True

    if os.getenv("GOOGLE_GENAI_API_KEY"):
        return True
    return False


class DialogueOrchestratorService:
    """Dialogue orchestration with optional LLM and deterministic fallback."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def build_daily_check_in(
        self,
        user: User,
        recent_quests: Sequence[QuestInstance],
        wellness_state: PlayerWellnessState,
    ) -> Dict[str, str]:
        completed = [quest for quest in recent_quests if quest.status == QuestStatusEnum.COMPLETED]
        active = [quest for quest in recent_quests if quest.status == QuestStatusEnum.ACTIVE]

        now = _utcnow()
        extra_data = dict(wellness_state.extra_data or {})  # type: ignore[arg-type]
        cache_fingerprint = _build_daily_cache_fingerprint(now, wellness_state, recent_quests)
        cached_payload = self._read_cached_daily_message(extra_data, cache_fingerprint, now)
        if cached_payload is not None:
            return cached_payload

        echo_memory: List[str] = list(extra_data.get("echo_memory", [])) if isinstance(extra_data.get("echo_memory", []), list) else []
        prompt = _build_prompt(user, completed, active, wellness_state, echo_memory)

        message = await self._generate_ai_message(prompt) if _llm_is_available() else None
        source = "llm" if message else "fallback"
        if not message:
            message = self._render_fallback_message(user, completed, active, wellness_state)

        sanitized = sanitize_text(message)
        new_memory = (echo_memory + [sanitized])[-_MAX_MEMORY:]
        generated_at = _to_iso(now)
        expires_at = _to_iso(_next_utc_midnight(now))

        extra_data["echo_memory"] = new_memory
        extra_data["last_ai_message_at"] = generated_at
        extra_data[_DAILY_CACHE_KEY] = {
            "fingerprint": cache_fingerprint,
            "message": sanitized,
            "tone": "supportive",
            "source": source,
            "generated_at": generated_at,
            "expires_at": expires_at,
        }
        wellness_state.extra_data = extra_data
        await self.session.flush()

        return {
            "message": sanitized,
            "tone": "supportive",
            "generated_at": generated_at,
            "source": source,
        }

    def _read_cached_daily_message(
        self,
        extra_data: Dict[str, Any],
        expected_fingerprint: str,
        now: datetime,
    ) -> Dict[str, str] | None:
        cache = extra_data.get(_DAILY_CACHE_KEY)
        if not isinstance(cache, dict):
            return None

        fingerprint = cache.get("fingerprint")
        if fingerprint != expected_fingerprint:
            return None

        message = cache.get("message")
        tone = cache.get("tone", "supportive")
        generated_at = cache.get("generated_at")
        expires_at_raw = cache.get("expires_at")
        if not isinstance(message, str) or not message.strip():
            return None
        if not isinstance(generated_at, str) or not generated_at:
            return None

        expires_at = _parse_iso(expires_at_raw if isinstance(expires_at_raw, str) else None)
        if expires_at is not None and expires_at <= now:
            return None

        return {
            "message": message,
            "tone": tone if isinstance(tone, str) and tone else "supportive",
            "generated_at": generated_at,
            "source": "cache",
        }

    async def fetch_recent_quests(self, user_id: int, limit: int = 5) -> List[QuestInstance]:
        stmt = (
            select(QuestInstance)
            .options(selectinload(QuestInstance.template))
            .where(QuestInstance.user_id == user_id)
            .order_by(QuestInstance.issued_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars())

    async def _generate_ai_message(self, prompt: str) -> str | None:
        history = [{"role": "user", "content": prompt}]
        try:
            response = await llm.generate_response(
                history=history,
                model="gemini_google",
                max_tokens=220,
                temperature=0.4,
                system_prompt=_SYSTEM_PROMPT,
            )
        except Exception as exc:  # pragma: no cover - safety
            logger.warning("LLM generation failed, using fallback. Error: %s", exc)
            return None

        if not response:
            return None

        trimmed = response.strip()
        if not _passes_guardrails(trimmed):
            logger.warning("LLM output failed guardrails; falling back.")
            return None

        return trimmed

    def _render_fallback_message(
        self,
        user: User,
        completed: Sequence[QuestInstance],
        active: Sequence[QuestInstance],
        wellness_state: PlayerWellnessState,
    ) -> str:
        preferred_name = user.preferred_name or user.first_name or user.name or "teman"
        if completed:
            latest = completed[0]
            template_name = latest.template.name if latest.template else "quest terakhir"
            streak = wellness_state.current_streak
            if streak > 1:
                return (
                    f"Halo, {preferred_name}! Kamu baru saja menyelesaikan **{template_name}**. "
                    f"Streak kamu sudah {streak} hari - jaga ritme hangat ini, ya."
                )
            return (
                f"Halo, {preferred_name}! Aku senang kamu menuntaskan **{template_name}**. "
                "Ambil napas dan perhatikan perasaan nyaman yang hadir."
            )

        if active:
            next_quest = active[0]
            name = next_quest.template.name if next_quest.template else "quest berikutnya"
            prompt_text = (
                "Ambil napas dulu, lalu kita coba pelan-pelan."
                if wellness_state.compassion_mode_active
                else "Saat kamu siap, mari kita lakukan bersama."
            )
            return f"Halo, {preferred_name}! Quest berikutnya adalah **{name}**. {prompt_text}"

        return (
            f"Halo, {preferred_name}! Kamu sudah mengambil langkah bagus hari ini. "
            "Jika butuh momen rehat, aku di sini kapan pun kamu siap."
        )
