import logging
from datetime import datetime
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.domains.mental_health.models import Conversation, UserSummary
from app.core import llm
from app.domains.mental_health.services.personal_context import invalidate_user_personal_context

logger = logging.getLogger(__name__)

MIN_TURNS_FOR_SUMMARY = 1
MAX_HISTORY_CHARS_FOR_SUMMARY = 12000

async def summarize_and_save(user_id: int, session_id_to_summarize: str) -> None:
    """Fetch history, create a summary, and persist it for future context injection."""
    logger.info(
        "Background Task: Starting summarization for user %s, session %s",
        user_id,
        session_id_to_summarize,
    )

    async with AsyncSessionLocal() as db:
        try:
            stmt = (
                select(Conversation)
                .where(
                    Conversation.session_id == session_id_to_summarize,
                    Conversation.user_id == user_id,
                )
                .order_by(Conversation.timestamp.asc())
            )
            result = await db.execute(stmt)
            conversation_history = result.scalars().all()

            if not conversation_history or len(conversation_history) < MIN_TURNS_FOR_SUMMARY:
                logger.info(
                    "Background Task: Skipping summarization for session %s (too short).",
                    session_id_to_summarize,
                )
                return

            history_lines = []
            for turn in conversation_history:
                history_lines.append(f"user: {turn.message}")
                history_lines.append(f"assistant: {turn.response}")
            formatted_history = "\n".join(history_lines)

            if len(formatted_history) > MAX_HISTORY_CHARS_FOR_SUMMARY:
                original_len = len(formatted_history)
                formatted_history = formatted_history[-MAX_HISTORY_CHARS_FOR_SUMMARY :]
                logger.warning(
                    "Background Task: Truncated conversation history for session %s from %s to %s chars.",
                    session_id_to_summarize,
                    original_len,
                    len(formatted_history),
                )

            summarization_prompt = f"""Kamu adalah Aika, AI pendamping dari UGM-AICare. Tugasmu adalah membuat ringkasan singkat dari percakapan sebelumnya dengan pengguna. Ringkasan ini akan kamu gunakan untuk mengingatkan pengguna tentang apa yang telah dibahas jika mereka bertanya \"apakah kamu ingat percakapan kita?\".

Buatlah ringkasan dalam 1-2 kalimat saja, dalam Bahasa Indonesia yang alami dan kasual, seolah-olah kamu sedang berbicara santai dengan teman. Fokus pada inti atau perasaan utama yang diungkapkan pengguna.
Hindari penggunaan daftar, poin-poin, judul seperti \"Poin Utama\", atau format markdown. Cukup tuliskan sebagai paragraf singkat yang mengalir.

Contoh output yang baik:
\"kita sempat ngobrolin soal kamu yang lagi ngerasa nggak nyaman karena pernah gagal memimpin organisasi.\"
\"kamu cerita tentang perasaanmu yang campur aduk setelah kejadian di kampus.\"
\"kita kemarin membahas tentang kesulitanmu mencari teman dan bagaimana itu membuatmu merasa kesepian.\"

Percakapan yang perlu diringkas:
{formatted_history}

Ringkasan singkat dan kasual:"""

            summary_llm_history = [{"role": "user", "content": summarization_prompt}]

            summary_text = await llm.generate_response(
                history=summary_llm_history,
                model="gemini_google",
                max_tokens=2048,
                temperature=0.5,
            )

            if summary_text.startswith("Error:"):
                logger.error(
                    "Background Task: LLM error during summarization for session %s: %s",
                    session_id_to_summarize,
                    summary_text,
                )
                raise RuntimeError("LLM error during summarization")

            new_summary = UserSummary(
                user_id=user_id,
                summarized_session_id=session_id_to_summarize,
                summary_text=summary_text.strip(),
                timestamp=datetime.now(),
            )
            db.add(new_summary)
            await db.commit()
            logger.info(
                "Background Task: Saved summary for user %s from session %s",
                user_id,
                session_id_to_summarize,
            )
            await invalidate_user_personal_context(user_id)

        except Exception as exc:  # pragma: no cover - defensive logging
            await db.rollback()
            logger.error(
                "Background Task: Failed to summarize session %s for user %s: %s",
                session_id_to_summarize,
                user_id,
                exc,
                exc_info=True,
            )
