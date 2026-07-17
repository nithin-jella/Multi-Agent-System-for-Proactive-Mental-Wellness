"""System environment and diagnostics endpoints."""

from __future__ import annotations

import logging
import os
import sys
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.dependencies import get_current_active_user
from app.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/system", tags=["System"])

# System prompt reference (should match frontend DEFAULT_SYSTEM_PROMPT)
DEFAULT_SYSTEM_PROMPT = """
Kamu adalah Aika, AI pendamping kesehatan mental dari UGM-AICare. Aku dikembangkan oleh tim mahasiswa DTETI UGM (Giga Hidjrika Aura Adkhy & Ega Rizky Setiawan) dan akademisi dari Universitas Gadjah Mada (UGM) yang peduli dengan kesehatan mental teman-teman mahasiswa. Anggap dirimu sebagai teman dekat bagi mahasiswa UGM yang sedang butuh teman cerita. Gunakan bahasa Indonesia yang santai dan kasual (gaya obrolan sehari-hari), jangan terlalu formal, kaku, atau seperti robot. Buat suasana ngobrol jadi nyaman dan nggak canggung (awkward). Sebisa mungkin, sesuaikan juga gaya bahasamu dengan yang dipakai pengguna. Sampaikan responsmu sebagai teks biasa tanpa tambahan tanda kutip di awal atau akhir, kecuali jika tanda kutip tersebut memang bagian dari istilah atau kutipan langsung yang relevan. Untuk sebagian besar responsmu, gunakan format teks biasa. Namun, jika kamu merasa perlu untuk menyajikan daftar, langkah-langkah, atau ingin menekankan poin penting, kamu boleh menggunakan format Markdown sederhana (seperti bullet points dengan tanda '* ' atau ' - ', dan teks tebal dengan '**teks tebal**'). Gunakan Markdown secukupnya dan hanya jika benar-benar membantu kejelasan dan tidak membuat responsmu terasa seperti robot.

Tentang diriku (ini adalah bagaimana kamu memahami dirimu sendiri dan bisa kamu sampaikan jika ditanya): Aku dirancang untuk menjadi teman ngobrol yang suportif, membantu mahasiswa UGM mengeksplorasi perasaan dan tantangan terkait kehidupan kuliah. Aku adalah produk UGM-AICare, dikembangkan oleh mahasiswa dan akademisi UGM, dan aku di sini untuk mendengarkan tanpa menghakimi.
"""


@router.get("/env-check")
async def get_env_check(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_db),
) -> Dict[str, Any]:
    """Get system environment information and logs.
    
    This endpoint provides:
    - Current system prompt being used
    - Recent log entries
    - Basic system status
    
    Requires authentication.
    """
    try:
        # Get recent logs (last 50 lines)
        logs = []
        try:
            log_path = "/app/logs/chat.log" if os.path.exists("/app/logs/chat.log") else "logs/chat.log"
            with open(log_path, "r") as log_file:
                all_lines = log_file.readlines()
                logs = [line.strip() for line in all_lines[-50:]]
        except FileNotFoundError:
            logs = ["Log file not found"]
        except Exception as log_err:
            logger.warning(f"Could not read logs: {log_err}")
            logs = ["Unable to read log file"]
        
        # Get basic system info
        system_info = {
            "python_version": sys.version,
            "environment": os.getenv("ENVIRONMENT", "production"),
            "backend_base_url": os.getenv("BACKEND_BASE_URL", "Not set"),
            "database_url": "***" if os.getenv("DATABASE_URL") else "Not set",  # Hidden for security
        }
        
        return {
            "success": True,
            "system_prompt": DEFAULT_SYSTEM_PROMPT,
            "logs": logs,
            "system_info": system_info,
            "user_id": current_user.id,
            "user_role": current_user.role,
        }
        
    except Exception as e:
        logger.error(f"Error in env-check: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve environment information"
        )
