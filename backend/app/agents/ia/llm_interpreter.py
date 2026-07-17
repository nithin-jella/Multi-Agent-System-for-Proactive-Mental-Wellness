"""LLM-powered interpretation module for Insights Agent analytics results.

This module provides natural language interpretation of k-anonymized aggregated
analytics data, generating insights, trends, and actionable recommendations.

Privacy Guarantee: LLM only receives aggregated statistics that have already
passed k-anonymity checks (k ≥ 5). No individual user data is ever sent to LLM.
"""
from __future__ import annotations

import logging
from typing import Dict, List, Any
from datetime import datetime

from app.core.llm import generate_gemini_response

logger = logging.getLogger(__name__)


class InsightsInterpreter:
    """LLM-powered interpreter for analytics results.
    
    This class generates natural language interpretations, identifies trends,
    and creates actionable recommendations from k-anonymized analytics data.
    
    Privacy Note: Only aggregated, k-anonymized data is processed. The LLM
    never receives individual user records or personally identifiable information.
    """
    
    def __init__(self):
        """Initialize the insights interpreter."""
        self.system_prompt = """Anda adalah asisten analitik data untuk platform kesehatan mental mahasiswa UGM-AICare.

Tugas Anda:
1. Menganalisis data statistik yang telah dianonimkan
2. Mengidentifikasi tren dan pola penting
3. Memberikan insight yang actionable untuk administrator
4. Merekomendasikan intervensi berdasarkan data

Format Respons:
- Gunakan bahasa Indonesia yang profesional
- Fokus pada insight praktis
- Sertakan angka spesifik dari data
- Berikan rekomendasi yang dapat ditindaklanjuti

Catatan Privasi:
- Semua data sudah dianonimkan dan diagregasi
- Tidak ada informasi individual mahasiswa
- Mengikuti standar k-anonymity (k ≥ 5)
"""
    
    async def interpret_analytics(
        self,
        question_id: str,
        data: List[Dict[str, Any]],
        chart: Dict[str, Any],
        notes: List[str],
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Generate LLM interpretation of analytics results.
        
        Args:
            question_id: ID of the analytics question
            data: K-anonymized aggregated data rows
            chart: Chart configuration and data
            notes: Query-specific notes
            start_date: Analysis period start
            end_date: Analysis period end
            
        Returns:
            Dictionary containing:
            - interpretation: Natural language analysis
            - trends: List of identified trends
            - summary: Executive summary
            - recommendations: Actionable recommendations
        """
        try:
            # Build context from data
            data_summary = self._summarize_data(data)
            date_range = f"{start_date.strftime('%d %B %Y')} - {end_date.strftime('%d %B %Y')}"
            
            # Construct prompt
            user_prompt = f"""Silakan analisis data analitik berikut:

**Pertanyaan Analitik:** {question_id}
**Periode:** {date_range}
**Total Data Points:** {len(data)}

**Ringkasan Data:**
{data_summary}

**Catatan:**
{' | '.join(notes) if notes else 'Tidak ada catatan khusus'}

Berikan analisis dalam format berikut:

1. RINGKASAN EKSEKUTIF (1 paragraf - Natural Language)
   - Format naratif yang ringkas untuk administrator sibuk.
   - Contoh: "Sepanjang periode ini, sentimen mahasiswa menurun 12% yang didorong oleh lonjakan 'Stres Akademik'. Kasus risiko tinggi stabil, namun kebutuhan coaching meningkat."

2. INTERPRETASI UTAMA (2-3 paragraf)
   - Apa insight paling penting dari data ini?
   - Apa yang menonjol atau mengkhawatirkan?

3. TREN YANG TERIDENTIFIKASI (3-5 tren)
   - Format: "Tren: [deskripsi] | Signifikansi: [high/medium/low] | Implikasi: [penjelasan]"

4. REKOMENDASI (3-5 rekomendasi - Actionable)
   - Format: "Rekomendasi: [judul] | Prioritas: [high/medium/low] | Aksi: [langkah konkret]"
   - Contoh Aksi: "Adakan workshop manajemen waktu", "Kirim broadcast tips tidur", "Tambah konselor di Selasa malam".

5. METADATA PRIVASI
   - Wajib sertakan kalimat ini: "Data aggregated from {len(data)} records. K-anonymity (k ≥ 5) enforced to protect user privacy."

Pastikan setiap analisis didukung oleh angka spesifik dari data.
"""
            
            # Generate interpretation using Gemini
            logger.info(f"Generating LLM interpretation for question_id={question_id}")
            response = await generate_gemini_response(
                history=[
                    {"role": "user", "content": user_prompt}
                ],
                system_prompt=self.system_prompt,
                temperature=0.3,  # Lower temperature for analytical consistency
                max_tokens=2000
            )
            
            # Parse response into structured format
            parsed = self._parse_interpretation(response)
            
            logger.info(
                f"Interpretation generated: {len(parsed['trends'])} trends, "
                f"{len(parsed['recommendations'])} recommendations"
            )
            
            return parsed
            
        except Exception as e:
            logger.error(f"Failed to generate interpretation: {e}", exc_info=True)
            return {
                "interpretation": "Maaf, interpretasi tidak dapat dihasilkan saat ini.",
                "trends": [],
                "summary": "Data analitik tersedia, namun interpretasi otomatis gagal.",
                "recommendations": []
            }
    
    def _summarize_data(self, data: List[Dict[str, Any]]) -> str:
        """Create a text summary of the data for LLM context.
        
        Args:
            data: List of data rows (k-anonymized aggregates)
            
        Returns:
            Text summary of the data
        """
        if not data:
            return "Tidak ada data tersedia untuk periode ini."
        
        # Get column names
        columns = list(data[0].keys()) if data else []
        
        # Build summary
        summary_lines = []
        for i, row in enumerate(data[:10], 1):  # Limit to first 10 rows
            row_summary = " | ".join([f"{k}: {v}" for k, v in row.items()])
            summary_lines.append(f"  {i}. {row_summary}")
        
        if len(data) > 10:
            summary_lines.append(f"  ... dan {len(data) - 10} baris data lainnya")
        
        return "\n".join(summary_lines)
    
    def _parse_interpretation(self, llm_response: str) -> Dict[str, Any]:
        """Parse LLM response into structured format.
        
        Args:
            llm_response: Raw LLM response text
            
        Returns:
            Structured interpretation with trends and recommendations
        """
        # Simple parsing - extract sections based on keywords
        sections = {
            "interpretation": "",
            "trends": [],
            "summary": "",
            "recommendations": []
        }
        
        lines = llm_response.split('\n')
        current_section = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue

            is_bullet = line.startswith(("- ", "• ", "* "))
            
            # Detect section headers
            if not is_bullet and "INTERPRETASI" in line.upper():
                current_section = "interpretation"
            elif not is_bullet and "TREN" in line.upper():
                current_section = "trends"
            elif not is_bullet and "RINGKASAN" in line.upper():
                current_section = "summary"
            elif not is_bullet and "REKOMENDASI" in line.upper():
                current_section = "recommendations"
            elif current_section:
                # Add content to current section
                if current_section == "interpretation":
                    sections["interpretation"] += line + " "
                elif current_section == "summary":
                    sections["summary"] += line + " "
                elif current_section == "trends" and line.startswith(("- ", "• ", "* ")):
                    # Parse trend line
                    trend = self._parse_trend_line(line)
                    if trend:
                        sections["trends"].append(trend)
                elif current_section == "recommendations" and line.startswith(("- ", "• ", "* ")):
                    # Parse recommendation line
                    rec = self._parse_recommendation_line(line)
                    if rec:
                        sections["recommendations"].append(rec)
        
        # Clean up
        sections["interpretation"] = sections["interpretation"].strip()
        sections["summary"] = sections["summary"].strip()
        
        # If parsing failed, use raw response
        if not sections["interpretation"]:
            sections["interpretation"] = llm_response
        
        return sections
    
    def _parse_trend_line(self, line: str) -> Dict[str, Any] | None:
        """Parse a trend line into structured format.
        
        Args:
            line: Trend line from LLM response
            
        Returns:
            Structured trend dict or None if parsing fails
        """
        try:
            # Remove bullet point
            line = line.lstrip("- • * ").strip()
            
            # Try to extract components
            parts = line.split(" | ")
            if len(parts) >= 2:
                return {
                    "trend": parts[0].replace("Tren:", "").strip(),
                    "significance": parts[1].replace("Signifikansi:", "").strip() if len(parts) > 1 else "medium",
                    "implication": parts[2].replace("Implikasi:", "").strip() if len(parts) > 2 else ""
                }
            else:
                # Fallback: use entire line as trend
                return {
                    "trend": line,
                    "significance": "medium",
                    "implication": ""
                }
        except Exception:
            return None
    
    def _parse_recommendation_line(self, line: str) -> Dict[str, Any] | None:
        """Parse a recommendation line into structured format.
        
        Args:
            line: Recommendation line from LLM response
            
        Returns:
            Structured recommendation dict or None if parsing fails
        """
        try:
            # Remove bullet point
            line = line.lstrip("- • * ").strip()
            
            # Try to extract components
            parts = line.split(" | ")
            if len(parts) >= 2:
                return {
                    "recommendation": parts[0].replace("Rekomendasi:", "").strip(),
                    "priority": parts[1].replace("Prioritas:", "").strip() if len(parts) > 1 else "medium",
                    "action": parts[2].replace("Aksi:", "").strip() if len(parts) > 2 else ""
                }
            else:
                # Fallback: use entire line as recommendation
                return {
                    "recommendation": line,
                    "priority": "medium",
                    "action": ""
                }
        except Exception:
            return None
