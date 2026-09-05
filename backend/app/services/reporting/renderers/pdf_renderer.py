import io
import hashlib
import arabic_reshaper
from bidi.algorithm import get_display

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

from ..models import CanonicalReportContext


def shape_text(text: str, is_rtl: bool) -> str:
    """Reshapes Arabic text and applies bidi reordering for ReportLab."""
    if not text:
        return ""
    if is_rtl:
        try:
            reshaped = arabic_reshaper.reshape(text)
            return get_display(reshaped)
        except Exception:
            return text
    return text


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically inject running page numbers and headers."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))

        # Footer
        footer_text = f"Baseerah Academic Suite | Page {self._pageNumber} of {page_count}"
        self.drawCentredString(letter[0] / 2.0, 36, footer_text)

        # Header rule
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, letter[1] - 40, letter[0] - 54, letter[1] - 40)
        self.line(54, 48, letter[0] - 54, 48)

        self.restoreState()


class PdfReportRenderer:
    @staticmethod
    def render(context: CanonicalReportContext, language: str = "ar") -> tuple[bytes, str]:
        """
        Renders CanonicalReportContext into a styled, publication-ready PDF document.
        Returns: (pdf_bytes, document_hash)
        """
        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=letter,
            rightMargin=54,
            leftMargin=54,
            topMargin=54,
            bottomMargin=54
        )

        is_rtl = (language != "en")
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'ReportTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=18,
            leading=24,
            textColor=colors.HexColor("#1E1B4B"),
            alignment=2 if is_rtl else 0
        )

        subtitle_style = ParagraphStyle(
            'ReportSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#64748B"),
            alignment=2 if is_rtl else 0
        )

        h2_style = ParagraphStyle(
            'ReportH2',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#312E81"),
            spaceBefore=14,
            spaceAfter=6,
            alignment=2 if is_rtl else 0
        )

        body_style = ParagraphStyle(
            'ReportBody',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9.5,
            leading=14,
            textColor=colors.HexColor("#1E293B"),
            spaceAfter=4,
            alignment=2 if is_rtl else 0
        )

        callout_style = ParagraphStyle(
            'ReportCallout',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#0E7490"),
            spaceAfter=4,
            alignment=2 if is_rtl else 0
        )

        disclaimer_style = ParagraphStyle(
            'ReportDisclaimer',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#B45309"),
            alignment=2 if is_rtl else 0
        )

        story = []

        # 1. Institutional Banner
        org_name = context.manifest.organization_name_ar if is_rtl else context.manifest.organization_name_en
        story.append(Paragraph(shape_text(f"🏛️ {org_name}", is_rtl), title_style))
        story.append(Spacer(1, 4))

        title_text = context.title_ar if is_rtl else context.title_en
        story.append(Paragraph(shape_text(title_text, is_rtl), title_style))

        if context.subtitle_ar or context.subtitle_en:
            sub_text = context.subtitle_ar if is_rtl else context.subtitle_en
            story.append(Paragraph(shape_text(sub_text, is_rtl), subtitle_style))

        story.append(Spacer(1, 10))

        # 2. Metadata Box Table
        meta_data = [
            [
                shape_text(f"Report ID: {context.manifest.report_id}", is_rtl),
                shape_text(f"Date: {context.manifest.generated_at[:10]}", is_rtl)
            ],
            [
                shape_text(f"User: {context.manifest.generated_by_username}", is_rtl),
                shape_text(f"Audience: {context.manifest.audience.value}", is_rtl)
            ]
        ]
        meta_table = Table(meta_data, colWidths=[250, 250])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor("#334155")),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 8.5),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 14))

        # 3. Sections Rendering
        for sec in context.sections:
            sec_title = sec.title_ar if is_rtl else sec.title_en
            story.append(Paragraph(shape_text(sec_title, is_rtl), h2_style))
            story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=6))

            paragraphs = sec.paragraphs_ar if is_rtl else sec.paragraphs_en
            if not paragraphs and is_rtl:
                paragraphs = sec.paragraphs_en
            elif not paragraphs:
                paragraphs = sec.paragraphs_ar

            for p in paragraphs:
                story.append(Paragraph(shape_text(p, is_rtl), body_style))

            callouts = sec.callouts_ar if is_rtl else sec.callouts_en
            for c in callouts:
                story.append(Paragraph(shape_text(f"📌 {c}", is_rtl), callout_style))

            # Tables
            for tbl in sec.tables:
                headers = tbl.headers_ar if is_rtl else tbl.headers_en
                if not headers:
                    headers = tbl.headers_en or tbl.headers_ar

                if headers and tbl.rows:
                    table_content = []
                    # Shaped Headers
                    table_content.append([Paragraph(f"<b>{shape_text(str(h), is_rtl)}</b>", body_style) for h in headers])

                    # Shaped Rows
                    for r in tbl.rows:
                        table_content.append([Paragraph(shape_text(str(cell), is_rtl), body_style) for cell in r])

                    # Calculate colWidths
                    num_cols = len(headers)
                    col_width = (504.0 / num_cols) if num_cols > 0 else 500

                    t = Table(table_content, colWidths=[col_width] * num_cols)
                    t.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E1B4B")),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                        ('ALIGN', (0, 0), (-1, -1), 'RIGHT' if is_rtl else 'LEFT'),
                        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                        ('TOPPADDING', (0, 0), (-1, -1), 4),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#F8FAFC"), colors.white])
                    ]))
                    story.append(Spacer(1, 6))
                    story.append(t)
                    story.append(Spacer(1, 8))

        # 4. Disclaimer
        disclaimer = context.disclaimer_ar if is_rtl else context.disclaimer_en
        if disclaimer:
            story.append(Spacer(1, 14))
            story.append(Paragraph(shape_text(f"⚠️ {disclaimer}", is_rtl), disclaimer_style))

        # 5. Verification & Integrity Footer
        story.append(Spacer(1, 12))
        verif_text = f"Verification Code: {context.manifest.verification_code} | Protocol: SHA-256 Verified"
        story.append(Paragraph(shape_text(verif_text, is_rtl), subtitle_style))

        # Build Document
        doc.build(story, canvasmaker=NumberedCanvas)
        raw_bytes = buf.getvalue()
        doc_hash = hashlib.sha256(raw_bytes).hexdigest()
        return raw_bytes, doc_hash
