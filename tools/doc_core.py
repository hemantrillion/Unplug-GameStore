import os
import re
import sys
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

sys.stdout.reconfigure(encoding="utf-8")

LIGATURE_MAP = {
    "\u019F": "ti",     # Ɵ -> ti
    "\u01A9": "tt",     # Ʃ -> tt
    "\u019E": "tf",     # ƞ -> tf
    "\u014C": "ft",     # Ō -> ft
    "\u01AB": "tti",    # ƫ -> tti
    "\u0129": "fb",     # ĩ -> fb
    "\u0145": "fk",     # Ņ -> fk
    "\uFB00": "ff",     # ﬀ -> ff
    "\uFB01": "fi",     # ﬁ -> fi
    "\uFB02": "fl",     # ﬂ -> fl
    "\uFB03": "ffi",    # ﬃ -> ffi
    "\uFB04": "ffl",    # ﬄ -> ffl
    "\uF0B7": "-",      # bullet
    "\u2018": "'",
    "\u2019": "'",
    "\u201C": '"',
    "\u201D": '"',
    "\u2014": " - ",
    "\u2013": "-",
}

def clean_ocr(text):
    for k, v in LIGATURE_MAP.items():
        text = text.replace(k, v)
    text = text.replace("Settis", "Settings").replace("settis", "settings")
    text = re.sub(r"=== PAGE \d+ ===\s*", "", text)
    clean = "".join(c for c in text if c in ("\t", "\n", "\r") or (ord(c) >= 32 and ord(c) != 0xFFFE and ord(c) != 0xFFFF))
    return clean

class DocxBuilder:
    def __init__(self):
        self.p_xml = []

    def p(self, text, style="Normal", bold=False, italic=False, color="334155", size=22, space_before=0, space_after=120):
        rpr = []
        if bold: rpr.append("<w:b/>")
        if italic: rpr.append("<w:i/>")
        if color: rpr.append(f'<w:color w:val="{color}"/>')
        if size: rpr.append(f'<w:sz w:val="{size}"/>')
        rpr_str = f"<w:rPr>{''.join(rpr)}</w:rPr>" if rpr else ""
        ppr = f'<w:pPr><w:pStyle w:val="{style}"/><w:spacing w:before="{space_before}" w:after="{space_after}"/></w:pPr>'
        self.p_xml.append(f'<w:p>{ppr}<w:r>{rpr_str}<w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')

    def title(self, main_title, subtitle, meta=None):
        self.p(main_title, style="Title", bold=True, color="0F172A", size=50, space_before=500, space_after=100)
        self.p(subtitle, style="Subtitle", italic=True, color="475569", size=26, space_after=240)
        if meta:
            for k, v in meta:
                self.bullet(f"{k}:", v)
            self.p("", space_after=200)

    def unit_header(self, unit_num, unit_title):
        self.p(f"UNIT {unit_num}", style="Heading1", bold=True, color="1E3A8A", size=24, space_before=500, space_after=60)
        self.p(unit_title, style="Heading1", bold=True, color="0F172A", size=36, space_before=0, space_after=200)

    def h1(self, text):
        self.p(text, style="Heading1", bold=True, color="1E3A8A", size=28, space_before=320, space_after=120)

    def h2(self, text):
        self.p(text, style="Heading2", bold=True, color="25458C", size=24, space_before=240, space_after=90)

    def h3(self, text):
        self.p(text, style="Heading3", bold=True, color="1E293B", size=21, space_before=160, space_after=60)

    def body(self, text):
        self.p(text, style="Normal", color="334155", size=22, space_after=110)

    def bullet(self, bold_prefix, text):
        ppr = '<w:pPr><w:pStyle w:val="ListBullet"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="70"/></w:pPr>'
        runs = []
        if bold_prefix:
            runs.append(f'<w:r><w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">{escape(bold_prefix)} </w:t></w:r>')
        runs.append(f'<w:r><w:rPr><w:color w:val="334155"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">{escape(text)}</w:t></w:r>')
        self.p_xml.append(f'<w:p>{ppr}{"".join(runs)}</w:p>')

    def callout(self, tag, title_text, content_text, border_col, bg_col):
        ppr = f'<w:pPr><w:shd w:val="clear" w:color="auto" w:fill="{bg_col}"/><w:spacing w:before="140" w:after="140"/><w:ind w:left="360" w:right="360"/><w:pBdr><w:left w:val="single" w:sz="28" w:space="14" w:color="{border_col}"/></w:pBdr></w:pPr>'
        r_title = f'<w:r><w:rPr><w:b/><w:color w:val="{border_col}"/><w:sz w:val="21"/></w:rPr><w:t xml:space="preserve">[{escape(tag)}] {escape(title_text)}: </w:t></w:r>'
        r_text = f'<w:r><w:rPr><w:color w:val="1E293B"/><w:sz w:val="21"/></w:rPr><w:t xml:space="preserve">{escape(content_text)}</w:t></w:r>'
        self.p_xml.append(f'<w:p>{ppr}{r_title}{r_text}</w:p>')

    def anchor(self, topic, goal, prevents):
        text = f"In this module, you are studying [{topic}]. The engineering goal in UNPLUG is: {goal}. The real-world failure this prevents: {prevents}."
        self.callout("ANCHOR & LEARNING INTENT", topic, text, "4338CA", "EEF2FF")

    def mental_model(self, title_text, analogy, connection):
        text = f"Everyday Physical Metaphor: {analogy}\n\nTechnical Computer Science Reality: {connection}"
        self.callout("8TH GRADE MENTAL MODEL", title_text, text, "D97706", "FFFBEB")

    def case_study(self, disaster, what_happened, why_unplug):
        text = f"Real-World Disaster: {what_happened}\n\nUNPLUG Architectural Countermeasure: {why_unplug}"
        self.callout("REAL-WORLD CASE STUDY", disaster, text, "047857", "F0FDF4")

    def security_alert(self, threat, vector, defense):
        text = f"Adversarial Attack Vector: {vector}\n\nArchitectural Defense: {defense}"
        self.callout("SECURITY ALERT", threat, text, "991B1B", "FEF2F2")

    def lab(self, title_text, instruction):
        self.callout("HANDS-ON LAB EXPERIMENT", title_text, instruction, "0E7490", "ECFEFF")

    def code(self, snippet):
        for line in snippet.strip().split("\n"):
            ppr = '<w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/><w:spacing w:after="20"/><w:ind w:left="360" w:right="360"/><w:pBdr><w:left w:val="single" w:sz="12" w:space="8" w:color="CBD5E1"/></w:pBdr></w:pPr>'
            rpr = '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:color w:val="0F172A"/><w:sz w:val="19"/></w:rPr>'
            self.p_xml.append(f'<w:p>{ppr}<w:r>{rpr}<w:t xml:space="preserve">{escape(line)}</w:t></w:r></w:p>')

    def table(self, headers, rows):
        tbl_pr = """<w:tblPr>
            <w:tblW w:w="0" w:type="auto"/>
            <w:tblBorders>
                <w:top w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>
                <w:bottom w:val="single" w:sz="8" w:space="0" w:color="475569"/>
                <w:left w:val="none"/><w:right w:val="none"/>
                <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
                <w:insideV w:val="none"/>
            </w:tblBorders>
        </w:tblPr>"""
        h_cells = []
        for h in headers:
            tc = f"""<w:tc>
                <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1E3A8A"/><w:tcMar><w:top w:w="120"/><w:bottom w:w="120"/><w:left w:w="140"/><w:right w:w="140"/></w:tcMar></w:tcPr>
                <w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="19"/></w:rPr><w:t>{escape(h)}</w:t></w:r></w:p>
            </w:tc>"""
            h_cells.append(tc)
        rows_xml = [f"<w:tr>{''.join(h_cells)}</w:tr>"]

        for r in rows:
            r_cells = []
            for cell in r:
                tc = f"""<w:tc>
                    <w:tcPr><w:tcMar><w:top w:w="100"/><w:bottom w:w="100"/><w:left w:w="140"/><w:right w:w="140"/></w:tcMar></w:tcPr>
                    <w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:color w:val="334155"/><w:sz w:val="19"/></w:rPr><w:t>{escape(str(cell))}</w:t></w:r></w:p>
                </w:tc>"""
                r_cells.append(tc)
            rows_xml.append(f"<w:tr>{''.join(r_cells)}</w:tr>")

        self.p_xml.append(f'<w:tbl>{tbl_pr}{"".join(rows_xml)}</w:tbl>')

    def stream_text(self, text):
        cleaned = clean_ocr(text)
        lines = cleaned.splitlines()
        current_code = []
        in_code = False
        
        copy_tags = ("textcopy", "powershellcopy", "jsoncopy", "htmlcopy", "javascriptcopy",
                     "csscopy", "yamlcopy", "sqlcopy", "markdowncopy", "dotenvcopy", "bashcopy", "pythoncopy")

        for line in lines:
            stripped = line.strip()
            lower = stripped.lower()

            if any(lower.startswith(tag) for tag in copy_tags) or stripped.startswith("```"):
                if in_code and current_code:
                    self.code("\n".join(current_code))
                    current_code = []
                in_code = True
                for tag in copy_tags:
                    if lower.startswith(tag):
                        rem = stripped[len(tag):].strip()
                        if rem: current_code.append(rem)
                        break
                continue

            if in_code:
                if (stripped.startswith("```") or
                    re.match(r"^(Step \d+|Action:|What success looks like|Phase \d+|\d+\.\d+|#)\b", stripped, re.IGNORECASE)):
                    self.code("\n".join(current_code))
                    current_code = []
                    in_code = False
                    if stripped.startswith("```"):
                        continue
                else:
                    current_code.append(line)
                    continue

            if not stripped:
                continue

            if stripped.startswith("# "):
                self.h1(stripped[2:].strip())
            elif stripped.startswith("## "):
                self.h2(stripped[3:].strip())
            elif stripped.startswith("### "):
                self.h3(stripped[4:].strip())
            elif re.match(r"^(Phase \d+|UNIT \d+|CHAPTER \d+)\b", stripped, re.IGNORECASE):
                self.h1(stripped)
            elif re.match(r"^(\d+\.\d+)\s*[-—]?\s*", stripped):
                self.h2(stripped)
            elif re.match(r"^(Step \d+|Action:|What success looks like)\b", stripped, re.IGNORECASE):
                self.h3(stripped)
            elif re.match(r"^([•\-\*]|\d+\.)\s+", stripped):
                m = re.match(r"^([•\-\*]|\d+\.)\s+(.*)", stripped)
                self.bullet(m.group(1), m.group(2))
            else:
                self.body(stripped)

        if in_code and current_code:
            self.code("\n".join(current_code))

    def save(self, output_paths):
        body_xml = "".join(self.p_xml)
        document_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
{body_xml}
<w:sectPr>
<w:pgSz w:w="12240" w:h="15840"/>
<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
</w:sectPr>
</w:body>
</w:document>'''

        styles_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:default="1" w:styleId="Normal">
<w:name w:val="Normal"/>
<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="334155"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Title">
<w:name w:val="Title"/><w:basedOn w:val="Normal"/>
<w:rPr><w:b/><w:sz w:val="50"/><w:color w:val="0F172A"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Subtitle">
<w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/>
<w:rPr><w:sz w:val="26"/><w:color w:val="475569"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Heading1">
<w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>
<w:pPr><w:keepNext/></w:pPr>
<w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="1E3A8A"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Heading2">
<w:name w:val="heading 2"/><w:basedOn w:val="Normal"/>
<w:pPr><w:keepNext/></w:pPr>
<w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="25458C"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Heading3">
<w:name w:val="heading 3"/><w:basedOn w:val="Normal"/>
<w:pPr><w:keepNext/></w:pPr>
<w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="1E293B"/></w:rPr>
</w:style>
</w:styles>'''

        content_types = '''<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>'''

        package_rels = '''<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

        document_rels = '''<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>'''

        for path in output_paths:
            out = Path(path)
            out.parent.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                archive.writestr("[Content_Types].xml", content_types)
                archive.writestr("_rels/.rels", package_rels)
                archive.writestr("word/document.xml", document_xml)
                archive.writestr("word/styles.xml", styles_xml)
                archive.writestr("word/_rels/document.xml.rels", document_rels)
            print(f"Master manual built successfully: {out} ({os.path.getsize(out):,} bytes)")
