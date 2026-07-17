"""PDF Generator for Insights Agent (IA).

This module handles the generation of professional PDF reports for analytics insights.
It uses reportlab to create structured documents with:
- Header (Title, Date, Logo placeholder)
- Executive Summary
- Key Trends
- Recommendations
- Charts (placeholder)
"""
import os
from datetime import datetime
from typing import Dict, Any, List
import logging

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.units import inch

logger = logging.getLogger(__name__)

def generate_pdf_report(state: Dict[str, Any]) -> str:
    """Generate a PDF report from IA state.
    
    Args:
        state: IA agent state containing analytics results and interpretation.
        
    Returns:
        Relative URL path to the generated PDF.
    """
    try:
        # 1. Setup paths
        # Ensure static/reports directory exists
        base_dir = os.getcwd()
        reports_dir = os.path.join(base_dir, "static", "reports")
        os.makedirs(reports_dir, exist_ok=True)
        
        # Generate filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        question_id = state.get("ia_context", {}).get("question_id", "analytics")
        filename = f"IA_Report_{question_id}_{timestamp}.pdf"
        filepath = os.path.join(reports_dir, filename)
        
        # 2. Setup Document
        doc = SimpleDocTemplate(
            filepath,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )
        
        # 3. Styles
        styles = getSampleStyleSheet()
        title_style = styles["Heading1"]
        title_style.alignment = 1  # Center
        
        h2_style = styles["Heading2"]
        h2_style.textColor = colors.HexColor("#001d58")  # UGM Blue
        
        normal_style = styles["Normal"]
        normal_style.leading = 14
        
        elements = []
        
        # 4. Content Building
        
        # Header
        elements.append(Paragraph("UGM-AICare Analytics Report", title_style))
        elements.append(Spacer(1, 0.25 * inch))
        
        # Metadata
        date_str = datetime.now().strftime("%d %B %Y")
        elements.append(Paragraph(f"<b>Date:</b> {date_str}", normal_style))
        elements.append(Paragraph(f"<b>Topic:</b> {question_id.replace('_', ' ').title()}", normal_style))
        elements.append(Spacer(1, 0.25 * inch))
        
        # Executive Summary
        if state.get("ia_context", {}).get("summary"):
            elements.append(Paragraph("Executive Summary", h2_style))
            elements.append(Paragraph(state["summary"], normal_style))
            elements.append(Spacer(1, 0.2 * inch))
            
        # Interpretation
        if state.get("ia_context", {}).get("interpretation"):
            elements.append(Paragraph("Analysis & Interpretation", h2_style))
            elements.append(Paragraph(state["interpretation"], normal_style))
            elements.append(Spacer(1, 0.2 * inch))
            
        # Key Trends
        trends = state.get("ia_context", {}).get("trends", [])
        if trends:
            elements.append(Paragraph("Key Trends Identified", h2_style))
            for trend in trends:
                # Handle both string and dict trends
                trend_text = trend.get("description", str(trend)) if isinstance(trend, dict) else str(trend)
                elements.append(Paragraph(f"• {trend_text}", normal_style))
            elements.append(Spacer(1, 0.2 * inch))
            
        # Recommendations
        recs = state.get("ia_context", {}).get("recommendations", [])
        if recs:
            elements.append(Paragraph("Strategic Recommendations", h2_style))
            for rec in recs:
                rec_text = rec.get("action", str(rec)) if isinstance(rec, dict) else str(rec)
                elements.append(Paragraph(f"• {rec_text}", normal_style))
            elements.append(Spacer(1, 0.2 * inch))
            
        # Disclaimer
        elements.append(Spacer(1, 0.5 * inch))
        disclaimer_style = ParagraphStyle(
            'Disclaimer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.gray
        )
        elements.append(Paragraph(
            "This report was generated automatically by the UGM-AICare Insights Agent. "
            "Data is k-anonymized (k>=5) to protect user privacy.", 
            disclaimer_style
        ))
        
        # 5. Build PDF
        doc.build(elements)
        
        logger.info(f"PDF Report generated successfully: {filepath}")
        
        # Return relative URL
        return f"/static/reports/{filename}"
        
    except Exception as e:
        logger.error(f"Failed to generate PDF report: {e}", exc_info=True)
        return None
