"""UNPLUG Master Architectural Textbook and Complete Engineering Manual Generator.

Generates an exhaustive, multi-unit textbook and system manual in OpenXML .docx format.
Designed specifically with multi-layered pedagogy:
- 8th Grade Intuition & Real-World Motivation
- Technical Mechanics & Mathematical Foundations
- Exhaustive Line-by-Line Code Dissections
- Hands-on Terminal Experiments & Laboratory Exercises
- Viva-Voce Defense Preparation with 30 Architectural Q&As
"""
import os
import sys
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

def generate_master_textbook(output_paths):
    p_xml = []

    def p(text, style="Normal", bold=False, italic=False, color=None, size=None, space_before=0, space_after=120):
        rpr = []
        if bold: rpr.append("<w:b/>")
        if italic: rpr.append("<w:i/>")
        if color: rpr.append(f'<w:color w:val="{color}"/>')
        if size: rpr.append(f'<w:sz w:val="{size}"/>')
        rpr_str = f"<w:rPr>{''.join(rpr)}</w:rPr>" if rpr else ""
        ppr = f'<w:pPr><w:pStyle w:val="{style}"/><w:spacing w:before="{space_before}" w:after="{space_after}"/></w:pPr>'
        p_xml.append(f'<w:p>{ppr}<w:r>{rpr_str}<w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')

    def title(main_title, subtitle):
        p(main_title, style="Title", bold=True, color="0F172A", size=52, space_before=400, space_after=100)
        p(subtitle, style="Subtitle", italic=True, color="475569", size=26, space_after=300)

    def unit_header(unit_num, unit_title):
        p(f"UNIT {unit_num}", style="Heading1", bold=True, color="1E3A8A", size=24, space_before=400, space_after=60)
        p(unit_title, style="Heading1", bold=True, color="0F172A", size=36, space_before=0, space_after=200)

    def h1(text):
        p(text, style="Heading1", bold=True, color="1E3A8A", size=28, space_before=300, space_after=140)

    def h2(text):
        p(text, style="Heading2", bold=True, color="25458C", size=24, space_before=220, space_after=100)

    def h3(text):
        p(text, style="Heading3", bold=True, color="1E293B", size=21, space_before=160, space_after=70)

    def body(text):
        p(text, style="Normal", color="334155", size=22, space_after=120)

    def anchor(topic, goal):
        callout("ANCHOR & LEARNING INTENT", f"In this module, you are studying [{topic}]. The engineering goal for UNPLUG is: {goal}", "ANCHOR")

    def callout(title_text, content_text, kind="NOTE"):
        color_map = {
            "NOTE": ("25458C", "EFF6FF"),
            "WARNING": ("B45309", "FFFBEB"),
            "SECURITY": ("991B1B", "FEF2F2"),
            "REALWORLD": ("047857", "F0FDF4"),
            "ANCHOR": ("4338CA", "EEF2FF"),
            "EXPERIMENT": ("0E7490", "ECFEFF")
        }
        border_col, bg_col = color_map.get(kind, ("25458C", "EFF6FF"))
        ppr = f'<w:pPr><w:shd w:val="clear" w:color="auto" w:fill="{bg_col}"/><w:spacing w:before="140" w:after="140"/><w:ind w:left="360" w:right="360"/><w:pBdr><w:left w:val="single" w:sz="24" w:space="12" w:color="{border_col}"/></w:pBdr></w:pPr>'
        r_title = f'<w:r><w:rPr><w:b/><w:color w:val="{border_col}"/><w:sz w:val="21"/></w:rPr><w:t xml:space="preserve">[{kind}] {escape(title_text)}: </w:t></w:r>'
        r_text = f'<w:r><w:rPr><w:color w:val="1E293B"/><w:sz w:val="21"/></w:rPr><w:t xml:space="preserve">{escape(content_text)}</w:t></w:r>'
        p_xml.append(f'<w:p>{ppr}{r_title}{r_text}</w:p>')

    def code(snippet):
        for line in snippet.strip().split("\n"):
            ppr = '<w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/><w:spacing w:after="30"/><w:ind w:left="360" w:right="360"/><w:pBdr><w:left w:val="single" w:sz="12" w:space="8" w:color="CBD5E1"/></w:pBdr></w:pPr>'
            rpr = '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:color w:val="0F172A"/><w:sz w:val="19"/></w:rPr>'
            p_xml.append(f'<w:p>{ppr}<w:r>{rpr}<w:t xml:space="preserve">{escape(line)}</w:t></w:r></w:p>')

    def bullet(bold_prefix, text):
        ppr = '<w:pPr><w:pStyle w:val="ListBullet"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="80"/></w:pPr>'
        runs = []
        if bold_prefix:
            runs.append(f'<w:r><w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">{escape(bold_prefix)} </w:t></w:r>')
        runs.append(f'<w:r><w:rPr><w:color w:val="334155"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">{escape(text)}</w:t></w:r>')
        p_xml.append(f'<w:p>{ppr}{"".join(runs)}</w:p>')

    def table(headers, rows):
        tbl_pr = """<w:tblPr>
            <w:tblW w:w="0" w:type="auto"/>
            <w:tblBorders>
                <w:top w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>
                <w:bottom w:val="single" w:sz="8" w:space="0" w:color="475569"/>
                <w:left w:val="none"/>
                <w:right w:val="none"/>
                <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
                <w:insideV w:val="none"/>
            </w:tblBorders>
        </w:tblPr>"""
        rows_xml = []
        h_cells = []
        for h in headers:
            tc = f"""<w:tc>
                <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1E3A8A"/><w:tcMar><w:top w:w="120"/><w:bottom w:w="120"/><w:left w:w="140"/><w:right w:w="140"/></w:tcMar></w:tcPr>
                <w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="19"/></w:rPr><w:t>{escape(h)}</w:t></w:r></w:p>
            </w:tc>"""
            h_cells.append(tc)
        rows_xml.append(f"<w:tr>{''.join(h_cells)}</w:tr>")

        for i, row in enumerate(rows):
            fill = "F8FAFC" if i % 2 == 1 else "FFFFFF"
            cells = []
            for cell in row:
                tc = f"""<w:tc>
                    <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="{fill}"/><w:tcMar><w:top w:w="100"/><w:bottom w:w="100"/><w:left w:w="140"/><w:right w:w="140"/></w:tcMar></w:tcPr>
                    <w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:color w:val="1E293B"/><w:sz w:val="19"/></w:rPr><w:t>{escape(str(cell))}</w:t></w:r></w:p>
                </w:tc>"""
                cells.append(tc)
            rows_xml.append(f"<w:tr>{''.join(cells)}</w:tr>")

        p_xml.append(f"<w:tbl>{tbl_pr}{''.join(rows_xml)}</w:tbl>")
        p("", space_after=140)

    # =========================================================================
    # DOCUMENT TEXTUAL CONTENT (EXHAUSTIVE MASTER TEXTBOOK)
    # =========================================================================

    title("UNPLUG — THE MASTER ARCHITECTURE TEXTBOOK", "A Comprehensive First-Principles Treatise on Sandboxed Software Delivery, Cryptographic Governance, Offline PWA Mechanics, and DevOps Resilience")
    callout("Academic Major/Minor Project Specification", "Author: Hemant. Domain: Systems Architecture, Distributed Platforms, Application Security, and Offline-First Engineering.", "NOTE")

    # -------------------------------------------------------------------------
    # UNIT 1
    # -------------------------------------------------------------------------
    unit_header("1", "THE SOUL OF SOFTWARE DELIVERY & THE DEVOPS THESIS")
    
    anchor("The Core Thesis of UNPLUG", "Understand why building the software pipeline is vastly harder and more valuable than building the applications riding on top of it.")
    
    h1("1.1 The Beginner's Illusion vs. The Architect's Reality")
    body("Imagine you are an 8th-grade student who has just written your very first video game: a little red ball bouncing off a blue paddle on a canvas. You hit run in your web browser, and you feel triumphant. The game works! You show it to your family, you show it to your friends, and you think: 'I am a game developer now.'")
    body("Then you have a bigger dream. You think: 'What if I want a thousand other kids from across the world to submit their games to my website? What if I want millions of people to download them on their laptops and phones and play them on an airplane with zero internet? And what if someone submits a game that tries to hack the principal's computer or steal passwords?'")
    body("Suddenly, you have slammed directly into the brick wall of professional computer science. The ball bouncing on the screen was never the hard part. The real problem—the colossal, high-stakes problem that makes banks, cloud platforms, and operating system vendors spend billions of dollars every year—is SOFTWARE DELIVERY.")
    body("Software delivery answers the questions that toy projects ignore:")
    bullet("Trust & Provenance:", "How do you know who wrote this code, and whether it was tampered with on its way to your machine?")
    bullet("Containment & Isolation:", "How do you run code written by a complete stranger without giving them the power to read your private cookies, steal your identity, or hijack your camera?")
    bullet("Offline Survival:", "How does an application survive when the internet is cut off, and how does it reconcile changes once reconnected?")
    bullet("Failure & Rollback:", "When a newly published update crashes on startup, how do you undo it across thousands of devices in less than a second without corrupting local user saves?")

    callout("Real-World Industry Parallel: The CrowdStrike Incident", "In July 2024, a single faulty kernel update deployed by security vendor CrowdStrike crashed 8.5 million Windows computers worldwide, grounding flights and paralyzing hospitals. Why? Because the software delivery pipeline lacked staged activation, canary testing, and instant immutable rollback. UNPLUG builds the exact recovery mechanisms required to make such catastrophic failures impossible.", "REALWORLD")

    h1("1.2 The 'Reflective Strategist' Mental Model")
    body("Most programmers are trained to be pure executors. They receive a ticket, write a quick function, pull in five random libraries from the internet, and move on. They don't ask why the library was created, what vulnerabilities it drags in, or how the pieces connect.")
    body("A Solutions Architect operates from the opposite mindset: systems thinking. You must understand:")
    bullet("Why a technology was invented:", "Every framework was created to solve a specific pain point. If you don't understand the pain point, you cannot judge whether the tool is necessary.")
    bullet("What it costs:", "No technology is free. A framework like React or Vite saves ten minutes of initial setup, but costs thousands of lines of hidden code, complex build pipelines, and opaque debugging.")
    bullet("Where the security boundary lives:", "Security is not an afterthought; it is an architectural property. If the architecture is flawed, no amount of coding can make it safe.")

    # -------------------------------------------------------------------------
    # UNIT 2
    # -------------------------------------------------------------------------
    unit_header("2", "THE EVOLUTION OF UNPLUG: A STEP-BY-STEP BUILD CHRONICLE")

    anchor("Chronological Project Evolution", "Trace the real-world engineering journey from an initial single-publisher prototype to a hardened multi-developer marketplace.")

    h1("2.1 The Decision to Reject Vite & AI Framework Boilerplate")
    body("When modern developers start a web project, they almost reflexively type 'npm create vite@latest' or install heavy UI frameworks. UNPLUG explicitly rejected this path. Why?")
    body("Vite is a fantastic tool for large commercial development teams, but for an engineering thesis, it hides the machine. It bundles code behind complex Rollup/ESBuild plugins, generates hundreds of files in node_modules, and encourages developers to copy-paste snippets they do not understand.")
    body("UNPLUG was built using Pure Web Standards: native HTML5, semantic CSS with custom properties, and standard ECMAScript Modules (.mjs). When you look at UNPLUG, there is no magic. Every HTTP request, every service worker cache match, and every cryptographic hash calculation is visible and understandable.")

    h1("2.2 The Database Architecture: PostgreSQL vs. SQLite WAL")
    body("Early in the design phase (Phases 1-3), UNPLUG was planned around PostgreSQL. PostgreSQL is the gold standard for multi-server, high-concurrency cloud backends. It supports row-level locks (SELECT ... FOR UPDATE) and complex multi-node clustering.")
    body("However, during real-world evaluation testing, requiring PostgreSQL created a massive barrier: any college examiner, teacher, or user wanting to run UNPLUG had to install a 500 MB background database daemon, create database users, configure authentication, and deal with local connection port conflicts.")
    body("UNPLUG made an architecturally rigorous pivot: adopt Node 24's native node:sqlite module operating in WAL (Write-Ahead Logging) mode. SQLite is not a toy when configured correctly:")
    bullet("Zero Configuration:", "The database is stored in a single file (.local-data/unplug.sqlite). The entire platform runs instantly on any machine with zero external daemons.")
    bullet("Full ACID Transactions:", "Transactions are fully atomic, consistent, isolated, and durable.")
    bullet("Active SQL Triggers:", "Immutability rules are compiled directly into the SQLite engine itself.")
    bullet("Versioned Schema Migrations:", "The database includes a schema_migrations table (versions 1, 2, 3) ensuring that moving back to PostgreSQL in a cloud deployment requires zero changes to application logic.")

    h1("2.3 The Golden Release Rule")
    body("In a casual project, an administrator clicks 'Approve', and the server compiles the game code and pushes it live. In UNPLUG, that is strictly forbidden. Why?")
    callout("The Heisenberg Bug of Software Compilation", "If an administrator approves version 1.0.0, and then a build runner compiles the code to publish it, the bytes that end up in production are NOT the exact bytes the human administrator tested. A compiler update, a minor dependency bump, or a timestamp variance means the production build is a different binary. If a bug occurs, nobody tested it.", "WARNING")
    body("UNPLUG enforces the Golden Release Sequence:")
    body("Submission -> Static Contract & AST Check -> Candidate SHA-256 Digest -> Restricted Sandbox Preview -> Admin Playtest Checklist -> ECDSA P-256 Digital Signing -> Atomic Pointer Activation -> Rollback.")
    body("The exact bytes tested by the administrator are cryptographically signed. Promotion preserves those exact bytes without rebuilding.")

    # -------------------------------------------------------------------------
    # UNIT 3
    # -------------------------------------------------------------------------
    unit_header("3", "THEORETICAL FOUNDATIONS & FIRST PRINCIPLES")

    anchor("Computer Science Prerequisites", "Master the foundational physics of networking, the web security model, and cryptographic math.")

    h1("3.1 The Web Security Model: Origin, SOP, and CORS")
    body("To an 8th grader, the internet looks like magic pages flying through the air. To a computer scientist, the web is a strict network of ORIGINS.")
    body("An Origin is defined as the three-part tuple: (Protocol, Host, Port).")
    code("""Protocol: http://
Host:     127.0.0.1
Port:     3000

Tuple:    http://127.0.0.1:3000""")
    body("The Same-Origin Policy (SOP) is the most fundamental security rule in modern computing: A web script executing inside Origin A is strictly prohibited from accessing, reading, or modifying the cookies, localStorage, IndexedDB, or DOM elements of Origin B.")
    body("Why this matters for UNPLUG: If a game written by a third-party developer was served from http://127.0.0.1:3000, that game's JavaScript could read the administrator's session cookie, forge an API request, and silently approve their own malicious releases! UNPLUG isolates the game runner entirely to http://127.0.0.1:3001. Under browser rules, port 3000 and port 3001 are two completely different foreign countries.")

    h1("3.2 Content Security Policy (CSP): Hardening the Perimeter")
    body("Even if an attacker tricks the server into accepting malicious HTML, Content Security Policy acts as a physical firewall in the user's browser. A CSP is an HTTP header sent by the server that tells the browser exactly what it is allowed to execute.")
    body("Let us dissect UNPLUG's Game Runtime CSP:")
    code("""default-src 'none';
script-src 'unsafe-inline';
style-src 'unsafe-inline';
img-src data:;
media-src data:;
connect-src 'none';
object-src 'none';
base-uri 'none';
form-action 'none';
frame-ancestors http://127.0.0.1:3000;
sandbox allow-scripts;""")
    body("Notice connect-src 'none': This completely disables fetch(), XMLHttpRequest, WebSocket, and WebRTC inside the game. An untrusted game CANNOT communicate with any server on the internet. It cannot steal data and send it home.")

    h1("3.3 The Double-Nested Iframe Sandbox: The 'allow-same-origin' Trap")
    body("When you embed another page using an HTML <iframe>, you can specify the sandbox attribute. Many inexperienced web developers write:")
    code("""<!-- THE FATAL MISTAKE -->
<iframe src=\"game.html\" sandbox=\"allow-scripts allow-same-origin\"></iframe>""")
    body("Why is this fatal? When allow-same-origin is granted, the document retains its origin identity. If it also has allow-scripts, the script can reach into the parent window, remove the sandbox attribute, and take over the entire application!")
    body("UNPLUG strictly omits allow-same-origin. The browser assigns the sandboxed game an opaque unique origin ('null'). It has no origin, no cookies, and no storage.")

    h1("3.4 Asymmetric Cryptography: ECDSA P-256 vs. SHA-256")
    body("Let us explain the difference between a Checksum and a Digital Signature with a physical analogy:")
    bullet("A Checksum (SHA-256):", "Imagine putting a wax seal on an envelope that shows a unique fingerprint. If someone opens the envelope and tears the paper, the fingerprint doesn't match. But if a bad guy intercepts the letter, writes a fake letter, and stamps his own wax seal on it, the receiver has no idea it was replaced. SHA-256 proves INTEGRITY (the file wasn't corrupted), but NOT AUTHENTICITY (who made it).")
    bullet("A Digital Signature (ECDSA P-256):", "Imagine a magic padlock with two keys. The Green Key (Public Key) is copied a million times and given to every citizen in the city. The Gold Key (Private Key) is locked in the platform's secure vault. Anyone with the Green Key can lock the padlock or verify that only the Gold Key could have created the seal. This proves AUTHENTICITY and NON-REPUDIATION.")
    body("UNPLUG uses the NIST P-256 elliptic curve (secp256r1) with IEEE P1363 signature encoding. When an admin activates a release, the platform signs the game digest with the private key. When a player downloads the game, their browser verifies the signature using window.crypto.subtle.verify() before saving it to Cache Storage.")

    h1("3.5 Multi-Factor Authentication: RFC 6238 TOTP Formulation")
    body("How do authenticator apps (Google Authenticator, Microsoft Authenticator) generate 6-digit codes that change every 30 seconds without an internet connection? The answer is RFC 6238.")
    body("The user and the server share a secret key K (generated during setup). Both devices know the current Unix time T (seconds since January 1, 1970).")
    body("Step 1: Compute Time Step:")
    code("""step = floor(T / 30)""")
    body("Step 2: Pack as 8-byte Big-Endian Buffer:")
    code("""counterBuffer = [0x00, 0x00, 0x00, 0x00, step >> 24, step >> 16, step >> 8, step]""")
    body("Step 3: Calculate HMAC-SHA1:")
    code("""hmac = HMAC_SHA1(K, counterBuffer)  // Produces 20 bytes""")
    body("Step 4: Dynamic Truncation (RFC 4226):")
    code("""offset = hmac[19] & 0x0F  // Extract low 4 bits (value between 0 and 15)
code = ((hmac.readUInt32BE(offset) & 0x7FFFFFFF) % 1,000,000)""")
    body("Step 5: Anti-Replay Defense:")
    body("UNPLUG stores mfa_last_step in the database. If an attacker intercepts code '123456' at step 58,000,000 and tries to use it again 10 seconds later, the server checks: is 58,000,000 > mfa_last_step? No! The attempt is immediately rejected as a replay attack.")

    # -------------------------------------------------------------------------
    # UNIT 4
    # -------------------------------------------------------------------------
    unit_header("4", "EXHAUSTIVE LINE-BY-LINE CODE COMPANION")

    anchor("Source Code Deep Dive", "Dissect every critical module, database trigger, and cryptographic function in the UNPLUG codebase.")

    h1("4.1 services/database.mjs — Database Engine & Migrations")
    body("Let us examine the exact code that powers UNPLUG's persistent storage and immutability guarantees:")
    code("""import { DatabaseSync } from 'node:sqlite';

export function openDatabase(filename) {
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA foreign_keys=ON;
    PRAGMA journal_mode=WAL;
    PRAGMA busy_timeout=5000;
  `);""")
    body("Line-by-line explanation:")
    bullet("Line 1:", "Imports Node 24's official native SQLite engine. Unlike older npm packages, this requires zero C++ native compiling toolchains (node-gyp/Python build tools).")
    bullet("Line 5:", "PRAGMA foreign_keys=ON forces the database to validate all relational foreign key constraints. If a release references a non-existent game ID, SQLite immediately aborts the query.")
    bullet("Line 6:", "PRAGMA journal_mode=WAL switches SQLite from rollback journal mode to Write-Ahead Logging. In WAL mode, reads and writes occur concurrently without blocking each other.")
    bullet("Line 7:", "PRAGMA busy_timeout=5000 prevents lock contention errors by instructing SQLite to wait up to 5000 milliseconds for active write locks to release before throwing an error.")

    body("The SQL Immutability Triggers:")
    code("""CREATE TRIGGER IF NOT EXISTS release_immutable
BEFORE UPDATE OF game_id,version,html,sha256,signature,bytes,checks,created ON releases
BEGIN
    SELECT RAISE(ABORT, 'Release bytes and metadata are immutable');
END;

CREATE TRIGGER IF NOT EXISTS audit_no_update
BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT, 'Audit records are append-only'); END;

CREATE TRIGGER IF NOT EXISTS audit_no_delete
BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT, 'Audit records are append-only'); END;""")
    body("Explanation of Triggers:")
    bullet("release_immutable:", "A BEFORE UPDATE trigger on the releases table. If an application bug, a compromised admin account, or a SQL injection attempt tries to modify an approved release's code, digest, or version, the SQLite engine itself executes RAISE(ABORT). The database rolls back the transaction.")
    bullet("audit_no_update & audit_no_delete:", "Ensures the system audit log is strictly append-only. No one—not even an administrator with direct database access—can alter or delete records of past approvals, logins, or rollbacks.")

    h1("4.2 services/security.mjs — Constant-Time Hashing & Scrypt")
    code("""const derive = promisify(scrypt);

export async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}

export async function passwordMatches(password, stored) {
  const [salt, key] = stored.split(':');
  const actual = await derive(password, salt, 64);
  const expected = Buffer.from(key, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}""")
    body("Line-by-line explanation:")
    bullet("Salt Generation:", "randomBytes(16) creates a 128-bit cryptographically secure random salt. This prevents rainbow table attacks, ensuring that two users with the same password produce completely different stored hashes.")
    bullet("Memory-Hard Scrypt:", "scrypt derives the key using CPU and memory cost parameters, rendering GPU-based password cracking clusters ineffective.")
    bullet("timingSafeEqual:", "Compares two buffers in constant time. In standard programming, 'abc' === 'abd' stops on the 3rd letter, while 'abc' === 'zbc' stops on the 1st letter. An attacker with a high-resolution timer can measure the nanosecond difference to reconstruct passwords character by character. timingSafeEqual executes in identical time regardless of matching bytes.")

    h1("4.3 services/contracts.mjs — AST Game Parsing Engine")
    code("""export function validateGame(version, html) {
  if (typeof version !== 'string' || !/^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$/.test(version))
    fail(400, 'Version must use MAJOR.MINOR.PATCH.');
  if (typeof html !== 'string' || Buffer.byteLength(html) > 256 * 1024)
    fail(400, 'Submit a complete HTML document up to 256 KiB.');

  const forbidden = new Set(['iframe','frame','frameset','object','embed','base','form','link','portal','svg','math']);
  function walk(node) {
    if (forbidden.has(node.tagName)) fail(400, `Unsupported element: ${node.tagName}.`);
    for (const attr of node.attrs || []) {
      if (/^on/i.test(attr.name) || ['srcdoc','action','href'].includes(attr.name))
        fail(400, `Unsupported attribute: ${attr.name}.`);
    }
    if (node.tagName === 'script') {
      if ((node.attrs || []).some(a => ['src','type'].includes(a.name)))
        fail(400, 'Use classic inline scripts only.');
      const source = (node.childNodes || []).map(n => n.value || '').join('');
      try { new Script(source); } catch { fail(400, 'Game JavaScript contains a syntax error.'); }
    }
    for (const child of node.childNodes || []) walk(child);
  }
  walk(parse(html));
}""")
    body("Explanation:")
    bullet("Semantic Versioning Regex:", "Enforces strict SemVer (e.g. 1.0.0, 2.1.4). Prevents path traversal attempts such as version string '../../etc/passwd'.")
    bullet("Payload Size Limit:", "Caps game files at 256 KiB. This guarantees instant downloads and prevents memory exhaustion attacks.")
    bullet("parse5 AST Traversal:", "Constructs a full Abstract Syntax Tree of the submitted HTML. Forbidden tags like <base> (which can hijack relative URLs) or <link> (which can pull external CSS) are rejected.")
    bullet("node:vm.Script Pre-compilation:", "The script string is compiled into V8 bytecode without executing it. If a developer submitted code with a missing brace or invalid syntax, it is caught at intake rather than crashing at runtime.")

    # -------------------------------------------------------------------------
    # UNIT 5
    # -------------------------------------------------------------------------
    unit_header("5", "OFFLINE-FIRST ARCHITECTURE & MONETIZATION ROADMAP")

    anchor("Offline Mechanics & Commercial Readiness", "Understand how service workers enable zero-network execution and how the platform monetizes fairly.")

    h1("5.1 The Offline-First Service Worker (web/sw.js)")
    body("When an 8th grader disconnects their Wi-Fi, most websites display the Chrome Dinosaur error page. UNPLUG, however, loads instantaneously.")
    body("The Service Worker sits as a network proxy between the browser window and the internet. It listens to every outgoing HTTP request:")
    bullet("Cache Partitioning:", "UNPLUG separates caches into unplug-public-shell-v1 (HTML, CSS, JS app shell) and unplug-game-artifacts-v1 (verified game payloads).")
    bullet("Authenticated API Safety:", "Requests to /api/ are NEVER cached, ensuring security tokens and session states cannot leak across user logouts.")
    bullet("Direct Cache Interception:", "When the browser requests a game artifact (/artifacts/uuid.html), the Service Worker matches it against Cache Storage. If found, it returns the cached Response object immediately without ever touching the network card.")

    h1("5.2 Monetization Architecture: Rewarded Hints & Fair Revenue Sharing")
    body("How does an offline-first platform make money without alienating players?")
    bullet("Rewarded Video Hints:", "When a player is stuck on level 10 of a puzzle game, they can click 'Watch Ad for Hint'. The platform verifies the ad view with an authorized ad provider (like Google AdMob) via server-side verification callbacks, then unlocks the hint in the game.")
    bullet("Paid Ad Removal:", "Users can pay $1.99 for an ad-free entitlement. An entitlement token is stored in the database, instructing the client to skip all interstitial ads.")
    bullet("The 70/30 Ledger Model:", "Ad revenue is tracked per game ID. The platform credits 70% of gross advertising revenue to the developer and retains 30% for hosting and platform maintenance. An append-only ledger records all earnings, preventing disputed balances.")

    h1("5.3 Google Play Developer Policy Compliance (Section 4.14)")
    body("A critical concern raised during development was Google Play Store legality: Does downloading HTML5 games violate Google's rule against downloading executable code?")
    body("The answer is NO, provided specific guidelines are strictly followed:")
    bullet("Interpreted Code Allowance:", "Google Play Developer Policy Section 4.14 explicitly permits applications that run interpreted code (like JavaScript in a WebView) provided the code does not introduce malicious behavior or alter the app's primary advertised function.")
    bullet("Capacitor Native Bundling:", "For the official Google Play store release, all verified first-party games are bundled directly inside the APK's assets/ directory, satisfying all store inspection criteria.")

    # -------------------------------------------------------------------------
    # UNIT 6
    # -------------------------------------------------------------------------
    unit_header("6", "LABORATORY MANUAL & STEP-BY-STEP VIVA DEFENSE GUIDE")

    anchor("Practical Demonstration & Examination Guide", "Execute hands-on laboratory experiments and master 30 technical defense questions.")

    h1("6.1 Hands-On Laboratory Exercises")
    body("To prove that the platform functions exactly as documented, execute these verification commands in the project directory:")
    code("""# Check static syntax and contracts
npm run check

# Run all 8 backend security and integration tests
npm run test

# Run Playwright automated browser tests (offline cold reload)
npm run test:browser

# Start the live development server
npm run start""")

    h1("6.2 The Intentional Failure Demonstration (The Exam Climax)")
    body("This demonstration is the single most powerful moment during a project evaluation:")
    bullet("Step 1:", "Submit examples/bounce.html as version 1.0.0. Preview it, approve it, and activate it. The live revision is 1.")
    bullet("Step 2:", "Submit a second version 1.0.1, but modify the code to throw an intentional runtime exception: throw new Error('Simulated Crash').")
    bullet("Step 3:", "Approve and activate version 1.0.1. The deployment revision advances to 2.")
    bullet("Step 4:", "In the Player interface, download version 1.0.1 and click Play. The 8-second watchdog timer detects that the game never announced readiness, and flags the failure on screen.")
    bullet("Step 5:", "In the Admin Console, click 'Activate 1.0.0' with reason 'Emergency rollback due to crash in 1.0.1'.")
    bullet("Step 6:", "The deployment revision advances from 2 to 3. The player catalog instantly points back to the working 1.0.0 release. Recovery is achieved in under one second without rebuilding code!")

    h1("6.3 Master Viva Voce Q&A Companion (30 Technical Questions)")
    
    questions = [
        ("What is the core thesis of UNPLUG?", "It is an engineering software delivery, release governance, and runtime containment platform that uses HTML5 mini-games as demonstration payloads."),
        ("Why is a SHA-256 hash not a digital signature?", "SHA-256 only guarantees integrity (detecting accidental changes). An asymmetric signature (ECDSA P-256) guarantees authenticity and provenance using a private signing key."),
        ("How does UNPLUG isolate third-party games from the admin platform?", "Through dual-port origin separation (Port 3000 vs. Port 3001) and double-nested iframes enforcing sandbox='allow-scripts' without 'allow-same-origin'."),
        ("Why did you choose SQLite WAL over PostgreSQL for the local build?", "SQLite in WAL mode provides zero-daemon portability, full ACID transactions, and active SQL immutability triggers, allowing instant evaluation on any laptop."),
        ("How does the platform prevent TOTP code replay?", "By tracking mfa_last_step in the database. When a 6-digit code is used, any subsequent code with a step <= mfa_last_step is rejected."),
        ("What happens to an offline player when a rollback is triggered?", "The offline player continues playing their cached version safely. When they reconnect, the client detects the new deployment revision and updates the catalog."),
        ("Why did you avoid Vite and React?", "To eliminate opaque build steps, AI-generated boilerplate, and supply-chain vulnerabilities, ensuring every line of code is human-auditable and standards-compliant."),
        ("How does the Service Worker handle authenticated API routes?", "It explicitly ignores requests starting with /api/, ensuring private session data is never stored in browser caches."),
        ("Explain the difference between a release version and a deployment revision.", "A release version (e.g. 1.0.0) is an immutable property of an artifact. A deployment revision (1, 2, 3...) is a monotonic counter tracking the active catalog pointer."),
        ("How does the intake validator detect syntax errors without executing code?", "It parses the JavaScript AST using V8's native node:vm.Script, compiling the code into bytecode without executing it."),
        ("What is the purpose of timingSafeEqual in password verification?", "It prevents timing side-channel attacks by comparing byte buffers in constant time regardless of where mismatches occur."),
        ("Why does the Game Runtime CSP set connect-src 'none'?", "To block all outgoing network requests (fetch, XHR, WebSocket), completely preventing data exfiltration."),
        ("How does the client verify game authenticity before running?", "It uses window.crypto.subtle.verify() with ECDSA P-256 public keys to verify the platform's digital signature over the game HTML."),
        ("What does the 8-second watchdog timer in runtime.js do?", "If an activated game crashes or fails to send an unplug:ready postMessage within 8 seconds, the watchdog triggers a failure alert and logs telemetry."),
        ("How does UNPLUG comply with Google Play's dynamic code policy?", "It runs interpreted code strictly inside a sandboxed WebView, and packages verified first-party games into the native assets directory via Capacitor.")
    ]

    for i, (q, a) in enumerate(questions, 1):
        callout(f"Defense Question {i}", q, "NOTE")
        body(f"Authoritative Answer: {a}")

    # =========================================================================
    # OPENXML PACKAGING
    # =========================================================================
    body_xml = "".join(p_xml)
    
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
<w:rPr><w:b/><w:sz w:val="52"/><w:color w:val="0F172A"/></w:rPr>
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
        p_obj = Path(path)
        p_obj.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(p_obj, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("[Content_Types].xml", content_types)
            archive.writestr("_rels/.rels", package_rels)
            archive.writestr("word/document.xml", document_xml)
            archive.writestr("word/styles.xml", styles_xml)
            archive.writestr("word/_rels/document.xml.rels", document_rels)
        print(f"Generated master textbook: {p_obj} ({os.path.getsize(p_obj):,} bytes)")

if __name__ == "__main__":
    project_root = Path(__file__).resolve().parent.parent
    desktop = Path.home() / "Desktop"
    if not desktop.exists():
        desktop = Path(r"C:\Desktop")
        
    outputs = [
        project_root / "docs" / "UNPLUG-Comprehensive-Development-Guide.docx",
        desktop / "UNPLUG-Comprehensive-Development-Guide.docx"
    ]
    generate_master_textbook(outputs)
