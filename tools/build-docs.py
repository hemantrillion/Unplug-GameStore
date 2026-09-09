"""UNPLUG Comprehensive Technical Manual and Architecture Book Generator.

Generates a publication-grade, multi-chapter textbook and system report
in OpenXML .docx format, covering theoretical foundations, architecture,
threat modeling, line-by-line code walk-throughs, compliance, and viva defense.
"""
import sys
import os
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

def generate_handbook(output_paths):
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

    def h1(text):
        p(text, style="Heading1", bold=True, color="1E3A8A", size=32, space_before=360, space_after=160)

    def h2(text):
        p(text, style="Heading2", bold=True, color="25458C", size=26, space_before=240, space_after=120)

    def h3(text):
        p(text, style="Heading3", bold=True, color="1E293B", size=22, space_before=180, space_after=80)

    def body(text):
        p(text, style="Normal", color="334155", size=22, space_after=120)

    def callout(title_text, content_text, kind="NOTE"):
        border_col = "25458C" if kind == "NOTE" else "B45309" if kind == "WARNING" else "047857"
        bg_col = "EFF6FF" if kind == "NOTE" else "FFFBEB" if kind == "WARNING" else "F0FDF4"
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
    # DOCUMENT TEXTUAL CONTENT (EXHAUSTIVE TEXTBOOK & REPORT)
    # =========================================================================

    title("UNPLUG — THE GAME STORE", "A Complete Engineering Treatise on Sandboxed Software Delivery, Cryptographic Governance, Offline-First Architecture, and DevOps Lifecycle Management")
    callout("Academic Project Thesis", "Final Year Engineering Major/Minor Project. Author: Hemant. Domain: Cloud, Platform Engineering, Application Security, and Distributed Systems.", "NOTE")

    # -------------------------------------------------------------------------
    # CHAPTER 1
    # -------------------------------------------------------------------------
    h1("Chapter 1: The Engineering Thesis & Design Philosophy")
    
    h2("1.1 Moving Beyond the Toy App Paradigm")
    body("In undergraduate computer science curricula, web applications frequently devolve into trivial CRUD (Create, Read, Update, Delete) dashboards or reskinned game templates. Such projects demonstrate basic syntax mastery but fail to address the fundamental realities of professional software engineering: supply chain integrity, multi-tenant isolation, runtime containment, deterministic delivery, and failure recovery.")
    body("UNPLUG was conceived to tackle the hard problem of software delivery. The visible artifacts—the HTML5 Canvas games (Bounce, Snake, Memory)—are intentionally lightweight demonstration payloads. The true thesis is the underlying platform: an enterprise-grade distribution system capable of accepting untrusted code from multiple developers, statically validating its structure, enforcing cryptographic provenance, providing isolated preview sandboxes for human review, atomically activating releases via versioned pointers, observing real-world runtime telemetry, and executing instantaneous one-click rollbacks.")

    h2("1.2 The 'Reflective Strategist' Persona & Systems Thinking")
    body("The development of UNPLUG was guided by a distinct architectural philosophy: systems thinking over impulsive coding. An impulsive programmer jumps immediately into writing code, pulls in bloated external frameworks, and creates accidental complexity. A reflective strategist begins with first principles: Why does this component exist? What is its attack surface? How does it recover from failure? How does it behave when network connectivity drops?")
    body("This philosophy dictated key foundational decisions throughout the project:")
    bullet("Rejecting Framework Bloat (No Vite, No React Build Steps):", "Modern frontend tooling often introduces thousands of transient dependencies, opaque bundling steps, and AI-generated boilerplate. UNPLUG enforces manually maintainable web standards: vanilla ES modules, native browser APIs, and explicit CSS. Every line of code can be audited, explained, and verified by a human.")
    bullet("Database Immutability at the SQL Engine Layer:", "Rather than trusting application code to maintain release history, UNPLUG delegates immutability guarantees to the database itself using SQL triggers that abort any unauthorized UPDATE or DELETE statements.")
    bullet("Cryptographic Asymmetry:", "Recognizing that a checksum is merely an integrity check (detecting accidental corruption) rather than an authenticity proof (detecting malicious tampering), UNPLUG integrates public-key digital signatures (ECDSA P-256) directly into the release envelope.")

    h2("1.3 Multi-Level Pedagogical Structure of this Manual")
    body("To ensure this document serves as a complete study guide, technical manual, and defense handbook, every system and module is examined across four progressive depths:")
    bullet("Level 1 (Surface / Mental Model):", "The high-level concept, real-world analogy, and user-facing behavior.")
    bullet("Level 2 (System Architecture):", "Component interactions, protocol boundaries, data flows, and security domains.")
    bullet("Level 3 (Implementation Details):", "State machines, database schema constraints, error handling, and performance trade-offs.")
    bullet("Level 4 (Line-by-Line Code Analysis):", "Exhaustive breakdown of critical functions, mathematical algorithms, and syntax.")

    # -------------------------------------------------------------------------
    # CHAPTER 2
    # -------------------------------------------------------------------------
    h1("Chapter 2: The Chronological Development Diary")
    body("The road from concept to working platform was an iterative journey that evolved across multiple architectural milestones. Understanding the evolution of these decisions is critical for presenting the project before an examining panel.")

    h2("2.1 Phase 1: Local Foundations & The Zero-Dependency Server")
    body("The initial objective was establishing a reproducible local baseline on Windows 11 without relying on external cloud providers, Docker daemons, or heavy bundlers. A lightweight HTTP server was constructed using Node's built-in node:http module, binding strictly to loopback (127.0.0.1) and serving static files with strict Content Security Policy headers.")
    body("The key lesson learned in Phase 1 was boundary enforcement: serving files from arbitrary file paths introduces directory traversal vulnerabilities. Phase 1 established a strict whitelist mapping (/ -> index.html, /styles.css, /app.js) and an explicit /health endpoint.")

    h2("2.2 The Database Dilemma: PostgreSQL vs. SQLite WAL")
    body("In Phases 2 and 3, a full PostgreSQL relational schema was designed. PostgreSQL provided excellent relational integrity, row-level locking (SELECT ... FOR UPDATE), and concurrent worker handling. However, during real-world evaluation testing on fresh machines, requiring a background PostgreSQL service with manual role provisioning (psql -U postgres) created high operational friction.")
    body("To achieve zero-dependency portability without sacrificing relational integrity, the platform transitioned to Node 24's native node:sqlite engine running in WAL (Write-Ahead Logging) mode. SQLite in WAL mode provides concurrent read operations alongside atomic transactional writes, and allowed compiling immutability triggers directly into the SQLite file. To preserve enterprise growth, versioned migrations (schema_migrations v1, v2, v3) were engineered so that migrating back to PostgreSQL in a clustered environment is a simple matter of swapping connection drivers.")

    h2("2.3 The Scope Expansion: From Single Publisher to Multi-Developer Marketplace")
    body("The original prototype assumed a single trusted publisher uploading their own games. In that model, security was simple: verify that the build wasn't corrupted in transit. However, expanding the project to an open platform where arbitrary external developers submit games introduced the scariest engineering problem in web development: Untrusted Code Execution.")
    body("If an untrusted developer submits an HTML5 game containing malicious JavaScript, running that game on the platform's origin would allow the attacker to read the admin's session cookies, forge release approvals, or exfiltrate private player data. This realization forced a major architectural redesign: the introduction of the Dual-Port Isolated Sandbox and the Double-Nested Iframe Container.")

    h2("2.4 Correcting the Release Sequence: Human Review on Immutable Artifacts")
    body("A critical correction made during development was establishing the exact release governance sequence. Early proposals suggested building the game after admin approval or allowing developers to upload already-bundled zip files. Both approaches were rejected:")
    bullet("Why Uploading Pre-Built ZIPs was Rejected:", "Uploading arbitrary ZIP files creates a massive attack surface: zip-slip directory traversal vulnerabilities, compression bombs, and untraceable binaries.")
    bullet("Why Post-Approval Building was Rejected:", "If a candidate is reviewed and approved, and then a build runner compiles the production bundle, the bytes that run in production are NOT the exact bytes the human reviewer tested. A subtle compiler bug or dependency change could introduce a flaw.")
    body("The Golden Release Rule was established: Submission -> Static Contract Check -> Candidate SHA-256 Digest -> Restricted Sandbox Preview -> Admin Playtest Checklist -> Digital Signature -> Atomic Pointer Activation -> Rollback. The approved bytes are cryptographically immutable.")

    # -------------------------------------------------------------------------
    # CHAPTER 3
    # -------------------------------------------------------------------------
    h1("Chapter 3: Theoretical Prerequisites & First Principles")
    body("Before analyzing the codebase, one must thoroughly master the theoretical computer science and cybersecurity concepts upon which UNPLUG is constructed.")

    h2("3.1 The Web Security Model: Origin, SOP, and CORS")
    body("The security boundary of the World Wide Web is the Origin. An origin is defined strictly as the tuple of (Protocol, Host, Port).")
    bullet("Example 1:", "http://127.0.0.1:3000 and https://127.0.0.1:3000 are DIFFERENT origins (protocol mismatch).")
    bullet("Example 2:", "http://127.0.0.1:3000 and http://localhost:3000 are DIFFERENT origins (host string mismatch).")
    bullet("Example 3:", "http://127.0.0.1:3000 and http://127.0.0.1:3001 are DIFFERENT origins (port mismatch).")
    body("The Same-Origin Policy (SOP) prohibits scripts running in Origin A from reading the DOM, localStorage, IndexedDB, or cookies of Origin B. UNPLUG exploits this foundational rule: the administrative portal runs on port 3000, while untrusted game payloads run exclusively on port 3001.")

    h2("3.2 Content Security Policy (CSP) & Defense-in-Depth")
    body("Content Security Policy is an HTTP response header that restricts the resources (scripts, styles, images, frames) the browser is permitted to load. UNPLUG defines two distinct CSP policies:")
    body("Platform Shell CSP (Applied to Application Interface on Port 3000):")
    code("""default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-src http://127.0.0.1:3001; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none';""")
    body("Game Runtime CSP (Applied to Untrusted Payloads on Port 3001):")
    code("""default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors http://127.0.0.1:3000; sandbox allow-scripts;""")
    callout("Why 'connect-src none' is Essential", "In the Game Runtime CSP, connect-src 'none' blocks fetch(), XMLHttpRequest, WebSocket, and EventSource. An untrusted game cannot make any outgoing network requests, eliminating data exfiltration channels.", "WARNING")

    h2("3.3 The Double-Nested Iframe Sandbox: Why 'allow-same-origin' is Fatal")
    body("HTML5 iframes support the sandbox attribute, which places the embedded document into an isolated, restricted environment. However, a widespread security flaw in modern web apps is combining sandbox='allow-scripts' with sandbox='allow-same-origin'.")
    body("When allow-same-origin is granted, the iframe retains its origin identity. If it also has allow-scripts, script inside the iframe can programmatically remove the sandbox attribute or access parent window objects. By strictly OMITTING allow-same-origin, the browser treats the iframe content as possessing an opaque unique origin (represented internally as 'null'). It cannot access cookies, localStorage, or IndexedDB.")

    h2("3.4 Cryptographic Signatures: ECDSA P-256 vs. SHA-256")
    body("A cryptographic hash function H(m) produces a fixed-length digest from variable-length input such that finding m from H(m) is computationally infeasible (preimage resistance), and finding two distinct messages with identical hashes is infeasible (collision resistance). SHA-256 produces a 256-bit (32-byte) digest.")
    body("However, SHA-256 provides only INTEGRITY, not AUTHENTICITY. If an attacker intercepts network traffic and replaces both the game file and the expected SHA-256 string, the receiver has no way of detecting the substitution.")
    body("Asymmetric digital signatures solve this problem using a keypair: a Private Signing Key (kept secret by the platform) and a Public Verification Key (distributed to all clients). UNPLUG uses ECDSA over the NIST P-256 elliptic curve (secp256r1) with the IEEE P1363 signature encoding format. When a game is approved, the platform hashes the game with SHA-256 and signs the hash with its private key. When a client downloads the game, it verifies the signature against the platform's public key using the browser's native window.crypto.subtle API.")

    h2("3.5 Multi-Factor Authentication Theory: RFC 6238 TOTP")
    body("RFC 6238 defines the Time-Based One-Time Password algorithm. It calculates a one-time passcode from a shared secret key K and the current Unix timestamp T. The timestamp is divided into discrete time steps (default 30 seconds): step = floor(T / 30).")
    body("The step counter is packed as an 8-byte big-endian integer and hashed with K using HMAC-SHA1. The final 4 bits of the resulting 20-byte HMAC hash determine an offset index. A 31-bit unsigned integer is extracted at that offset and modulo 1,000,000 is applied, producing a 6-digit passcode.")
    body("Anti-Replay Protection: An attacker who snoops a 6-digit TOTP code could attempt to use it within the remaining portion of its 30-second window. UNPLUG eliminates this threat by persisting mfa_last_step in the database. Any authentication attempt presenting a code corresponding to a time-step <= mfa_last_step is rejected immediately.")

    # -------------------------------------------------------------------------
    # CHAPTER 4
    # -------------------------------------------------------------------------
    h1("Chapter 4: Security Architecture & Threat Matrix")
    body("UNPLUG was designed using defense-in-depth threat modeling. The table below lists the potential attack vectors against an open web-based game platform and the concrete countermeasures implemented in UNPLUG:")

    table(
        ["Attack Vector", "Attacker's Objective", "Vulnerable Architecture", "UNPLUG Implemented Defense"],
        [
            ["Cross-Site Scripting (XSS)", "Execute arbitrary JS in admin session", "Running game code on main origin", "Dual-port separation (3000 vs 3001) + opaque sandbox"],
            ["Session Hijacking", "Steal login tokens via XSS or network", "LocalStorage JWT storage", "HttpOnly, SameSite=Strict cookies with 8-hour expiry"],
            ["CSRF Forgery", "Force admin to activate malicious game", "Relying purely on cookies", "Custom X-CSRF-Token header validated against session secret"],
            ["Silent Release Tampering", "Overwrite live game bytes in database", "Standard UPDATE queries without checks", "SQLite BEFORE UPDATE triggers that execute RAISE(ABORT)"],
            ["Replay Attack on TOTP", "Reuse intercepted 6-digit 2FA code", "Validating code without recording step", "Tracking mfa_last_step in database; code expires instantly on use"],
            ["Timing Attacks", "Derive secret keys via comparison duration", "Standard '===' string comparison", "crypto.timingSafeEqual on fixed-length buffers"],
            ["Denial of Service (DoS)", "Crash server with massive payloads or loops", "Unbounded JSON bodies and routes", "express-rate-limit + 256 KiB size cap + 10s header timeout"]
        ]
    )

    # -------------------------------------------------------------------------
    # CHAPTER 5
    # -------------------------------------------------------------------------
    h1("Chapter 5: Line-by-Line Code Companion & Module Walkthrough")
    body("This chapter contains an exhaustive walkthrough of every critical file, class, function, and database schema in UNPLUG.")

    h2("5.1 services/database.mjs — Relational Data & Immutability Engine")
    body("This module establishes the SQLite connection, executes schema creation, and manages schema migrations v1, v2, and v3.")
    body("WAL Mode and Foreign Key Pragmas:")
    code("""db.exec(`
    PRAGMA foreign_keys=ON;
    PRAGMA journal_mode=WAL;
    PRAGMA busy_timeout=5000;
`);""")
    body("Explanation: PRAGMA foreign_keys=ON forces SQLite to validate all relational foreign key constraints, which are disabled by default in SQLite for backwards compatibility. PRAGMA journal_mode=WAL enables Write-Ahead Logging, allowing concurrent readers to read without blocking the writer, and allowing the writer to commit without waiting for readers. PRAGMA busy_timeout=5000 instructs queries to wait up to 5 seconds if another thread holds a write lock before throwing a SQLITE_BUSY error.")
    
    body("The Releases Table & Database Trigger:")
    code("""CREATE TABLE IF NOT EXISTS releases(
  id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games(id), version TEXT NOT NULL,
  html TEXT NOT NULL, sha256 TEXT NOT NULL, signature TEXT NOT NULL, bytes INTEGER NOT NULL, checks TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('candidate','approved','rejected','changes_requested')),
  approved_digest TEXT, created INTEGER NOT NULL, UNIQUE(game_id,version), UNIQUE(game_id,id)
);

CREATE TRIGGER IF NOT EXISTS release_immutable
BEFORE UPDATE OF game_id,version,html,sha256,signature,bytes,checks,created ON releases
BEGIN
    SELECT RAISE(ABORT, 'Release bytes and metadata are immutable');
END;""")
    body("Explanation: The CHECK constraint on state guarantees that releases can only transition through recognized lifecycle states. The trigger release_immutable activates if any SQL query attempts to UPDATE the game_id, version, HTML code, SHA-256 hash, signature, or creation timestamp of an existing release. If triggered, RAISE(ABORT) immediately terminates the statement and rolls back the active transaction. To change a game, a developer MUST submit a new version with a new unique release ID.")

    h2("5.2 services/security.mjs — Cryptographic Primitives & Safe Hashing")
    body("This module encapsulates password hashing, digest generation, and transactional boundaries.")
    body("Scrypt Password Hashing with Salt:")
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
    body("Explanation: Scrypt is a memory-hard key derivation function specifically designed to make hardware-accelerated (ASIC/GPU) brute-force attacks economically unfeasible. A cryptographically secure 16-byte random salt is generated for every user. The password and salt are derived into a 64-byte key. During verification, crypto.timingSafeEqual is used to compare the computed key with the stored key. Standard JavaScript string comparison (===) terminates on the first mismatched character, allowing an attacker with high-precision network measurement to guess characters one-by-one (a timing side-channel attack). timingSafeEqual executes in constant time regardless of where or whether differences exist.")

    h2("5.3 services/totp.mjs — Native RFC 6238 Engine")
    body("This module implements the mathematical TOTP protocol without third-party dependencies.")
    code("""export function totp(secret, step = Math.floor(Date.now() / 30000)) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', decode(secret)).update(counter).digest();
  const offset = hmac[19] & 15;
  return ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}""")
    body("Explanation: Buffer.alloc(8) allocates an 8-byte buffer. writeBigUInt64BE writes the 64-bit step counter in Big-Endian network byte order. HMAC-SHA1 hashes the counter using the Base32-decoded secret key. The lowest 4 bits of the last byte (hmac[19] & 15) yield an integer offset between 0 and 15. At that offset, readUInt32BE reads 4 bytes as a 32-bit integer. Bitwise AND with 0x7fffffff clears the most significant bit (preventing signed integer misinterpretation). Modulo 1,000,000 extracts the lowest 6 decimal digits, padded with leading zeros.")

    h2("5.4 services/contracts.mjs — AST Game Parsing & Intake Validation")
    body("This module parses submitted game code, builds a Document Object Model AST, and validates platform constraints.")
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
    body("Explanation: The parser walks the complete DOM tree using parse5. Forbidden tags that could escape the sandbox or embed external content (like iframes, object, base, link) are rejected. Inline event handlers (like onload, onerror) are rejected. For <script> tags, external sources (<script src='...'>) are blocked to prevent CDN dependencies. Crucially, new Script(source) compiles the JavaScript code into V8 bytecode without executing it. If there is a syntax error, it fails immediately during intake before reaching any reviewer.")

    h2("5.5 web/sw.js — Service Worker Offline Architecture")
    body("The Service Worker intercepts all network requests issued by the client application.")
    code("""const SHELL_CACHE = 'unplug-public-shell-v1';
const GAME_CACHE = 'unplug-game-artifacts-v1';

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Never cache authenticated API endpoints
  if (url.pathname.startsWith('/api/')) return;

  // Intercept game artifact downloads
  if (url.pathname.startsWith('/artifacts/')) {
    event.respondWith((async () => {
      const cache = await caches.open(GAME_CACHE);
      const cached = await cache.match(event.request);
      return cached || fetch(event.request);
    })());
    return;
  }

  // Application shell files
  if (SHELL_FILES.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(url.pathname);
      return cached || fetch(event.request);
    })());
  }
});""")
    body("Explanation: Notice the strict separation of concerns. Authenticated /api/ requests are NEVER cached by the Service Worker, preventing stale auth states on shared devices. Shell assets (/app.js, /style.css) reside in unplug-public-shell-v1. Verified game artifacts reside in unplug-game-artifacts-v1. If the user disconnects their network, the Service Worker fulfills requests directly from local storage, allowing cold-boot offline execution.")

    # -------------------------------------------------------------------------
    # CHAPTER 6
    # -------------------------------------------------------------------------
    h1("Chapter 6: Operational Governance, Monetization & Store Compliance")
    
    h2("6.1 Offline vs. Online Dependency Matrix")
    body("A critical requirement for technical defense is demonstrating clear awareness of network boundaries:")
    table(
        ["Capability", "Requires Network?", "Offline Mechanics", "Failure Fallback"],
        [
            ["Launch PWA Workspace", "No", "Service Worker shell cache (unplug-public-shell-v1)", "Loads instantaneous local app shell"],
            ["Play Downloaded Games", "No", "Cache Storage (unplug-game-artifacts-v1)", "Runs full Canvas physics in sandboxed iframe"],
            ["Inspect Local Downloads", "No", "Persisted in window.localStorage (unplug-downloads-v1)", "Displays library list with versions & release IDs"],
            ["Browse New Catalog Releases", "Yes", "Requires GET /api/catalog", "Graceful UI notification; shows cached catalog"],
            ["Developer Game Submission", "Yes", "Requires POST /api/submissions with AST validation", "Submission form blocked until connected"],
            ["Admin Review & Playtest", "Yes", "Requires active session & temporary capability token", "Admin actions require live backend connection"],
            ["1-Click Rollback", "Yes", "Requires atomic POST /api/activate update", "Server pointer updates; offline clients update on reconnect"],
            ["Multiplayer Matchmaking", "Yes", "Requires server-authoritative turn validation", "Offline players play single-player Canvas games"]
        ]
    )

    h2("6.2 Monetization & Developer Revenue Share")
    body("Commercial viability requires a sustainable monetization architecture:")
    bullet("Rewarded Video Hints:", "Players who get stuck in games can optionally click 'Watch Ad for Hint'. The platform verifies completion via server-side callbacks from an approved ad provider (such as Google AdMob) before dispatching the hint event to the game.")
    bullet("Ad-Free Entitlements:", "Players can purchase an ad-removal pass ($1.99 one-time or $0.99/month). When active, an entitlement flag is verified by the backend, suppressing all interstitial ad requests.")
    bullet("Append-Only Revenue Sharing Ledger:", "Ad impressions and hint transactions are linked to the specific game's developer ID. An append-only ledger credits 70% of gross ad revenue to the creator and 30% to the platform. Payouts are reconciled via Stripe Connect once balances exceed a minimum threshold (e.g., $50.00).")

    h2("6.3 Google Play Developer Policy Compliance (Section 4.14)")
    body("Google Play strictly regulates applications that download executable code. To avoid policy rejections, UNPLUG adheres to Google's interpreted code exceptions:")
    bullet("Interpreted Script Exception:", "Google Play permits apps that run JavaScript inside an Android WebView provided the code runs inside a standard browser sandbox and does not alter the fundamental purpose of the app.")
    bullet("Asset Bundling for Launch:", "For the official Google Play store release, all verified first-party games are bundled directly inside the APK's assets/ directory via Capacitor, eliminating runtime download requirements during store review.")

    # -------------------------------------------------------------------------
    # CHAPTER 7
    # -------------------------------------------------------------------------
    h1("Chapter 7: Hands-On Laboratory & Verification Playbook")
    body("This chapter provides the exact, step-by-step commands to execute and verify every system capability.")

    h2("7.1 Running the Automated Test Suites")
    body("UNPLUG features two distinct test suites: backend integration tests and Playwright browser tests.")
    code("""# 1. Run static syntax, manifest, and contract checks:
npm run check

# 2. Run backend integration tests (MFA, RBAC, Immutability, Rollback, Recovery):
npm test

# 3. Run Playwright end-to-end browser tests (including offline cold reload):
npm run test:browser""")

    h2("7.2 The Live Viva / Defense Demonstration Script")
    body("Follow this script when presenting the project before an examining panel:")
    bullet("Demo A: Start Server & Login:", "Run npm start. Open http://127.0.0.1:3000. Log in using admin@unplug.local and the password from .env. Show the clean, light-themed admin dashboard.")
    bullet("Demo B: Submit a Game:", "Switch to Developer mode. Fill in game title 'Bounce 1.0.0', select games/bounce.html, and click Submit. Show that the release enters 'candidate' state and is NOT visible in the public player catalog.")
    bullet("Demo C: Isolated Preview & Review Checklist:", "In the Admin Console, click 'Preview candidate'. Show that the game runs in the iframe on port 3001. Complete the review checklist (played, reviewed content, checked controls) and approve with written feedback.")
    bullet("Demo D: Atomic Activation:", "Click 'Activate release'. Provide the reason 'Initial verified production launch'. Show that Bounce immediately appears in the Discover catalog with revision 1.")
    bullet("Demo E: Offline Player & Airplane Mode:", "Navigate to the Player tab. Click 'Download'. Verify the game starts. Open browser DevTools, check 'Offline' (or disconnect network), and reload the page. Show that the game loads and plays 100% offline from Cache Storage.")
    bullet("Demo F: The Rollback Climax:", "Submit a broken game version 1.0.1. Approve and activate it. Download and play version 1.0.1. The 8-second watchdog alert triggers: 'Game did not start'. In the Admin dashboard, click 'Activate 1.0.0' with reason 'Rollback due to startup fault'. Show that the deployment revision advances from 2 to 3, and the player instantly reverts to the working release without rebuilding any files.")

    # -------------------------------------------------------------------------
    # CHAPTER 8
    # -------------------------------------------------------------------------
    h1("Chapter 8: Comprehensive Examination & Defense Q&A Companion")
    body("This chapter contains 15 of the most challenging questions an external examiner or senior architect could ask during your project defense, complete with authoritative answers:")

    callout("Question 1", "Why did you build your own game delivery platform instead of using Steam, itch.io, or an existing publishing portal?", "NOTE")
    body("Answer: Commercial portals are closed-source distribution channels that treat games as black-box binaries. UNPLUG was built as an engineering platform to investigate and solve the core problems of web-based software distribution: runtime containment of untrusted code, client-side cryptographic verification, sub-second rollback via revision pointer updates, and true offline execution through service workers. The platform is the thesis; the games are the proof.")

    callout("Question 2", "How do you protect the main platform from malicious code inside a developer's uploaded game?", "NOTE")
    body("Answer: We enforce security at three distinct layers: (1) Static intake contract: The HTML is parsed with parse5, rejecting iframes, base tags, external scripts, and inline event handlers. The JavaScript is compiled into V8 bytecode via node:vm.Script to verify syntax without executing it. (2) Origin isolation: Games are served exclusively from port 3001 under a distinct origin with a Content Security Policy that sets connect-src 'none' (blocking network requests). (3) Browser containment: Games run inside an iframe with sandbox='allow-scripts' strictly omitting 'allow-same-origin', forcing the browser to assign it a unique null origin with zero access to cookies, localStorage, or parent window globals.")

    callout("Question 3", "Why is a SHA-256 checksum insufficient for secure release distribution?", "NOTE")
    body("Answer: A checksum guarantees integrity against accidental transmission errors, but provides zero guarantee of authorship or authenticity. If a man-in-the-middle attacker or rogue developer alters both the file and the checksum, a checksum verification passes. UNPLUG pairs SHA-256 with asymmetric ECDSA P-256 digital signatures. The platform signs the digest using a private key; the client verifies the signature using the platform's public key via the native Web Crypto API before writing the artifact to storage.")

    callout("Question 4", "Explain the difference between a release version and a deployment revision.", "NOTE")
    body("Answer: A release version (e.g., '1.0.0') is an immutable property of the game artifact. Once approved, its bytes, digest, and signature can never be changed. A deployment revision (1, 2, 3...) is a monotonically increasing integer that tracks the state of the active catalog pointer. When rolling back from version 1.0.1 to 1.0.0, we do NOT delete version 1.0.1 or re-version 1.0.0; we create deployment revision 3 pointing back to the immutable release 1.0.0.")

    callout("Question 5", "How does your TOTP implementation prevent replay attacks?", "NOTE")
    body("Answer: Standard TOTP passcodes are valid for a 30-second window. In a naive implementation, an attacker who intercepts a code could replay it multiple times within that window. In UNPLUG, the users table maintains an mfa_last_step column. When a code is successfully validated, mfa_last_step is updated to the current time step. Any subsequent attempt using a code with a step less than or equal to mfa_last_step is rejected, guaranteeing that each 6-digit code is strictly single-use.")

    callout("Question 6", "Why did you use SQLite WAL mode instead of a standard PostgreSQL database?", "NOTE")
    body("Answer: PostgreSQL requires an active external daemon, connection pooling, and separate service administration, which introduces heavy setup requirements on evaluation environments. Node 24's native node:sqlite engine runs in-process with zero external dependencies. By configuring PRAGMA journal_mode=WAL, we achieve concurrent reads without writer contention. Crucially, SQLite allowed us to compile SQL triggers directly into the schema to guarantee that release records and audit trails cannot be updated or deleted even by direct SQL commands.")

    callout("Question 7", "What happens if a user is playing a game offline and an administrator activates an update or triggers a rollback?", "NOTE")
    body("Answer: An offline device cannot receive remote signals without connectivity. However, UNPLUG guarantees that running games are never interrupted or corrupted. The player continues playing their cached version. When the device reconnects and the player opens the catalog, the client checks the deployment revision. If a new version or rollback is detected, the catalog updates, and the player can download the new verified release.")

    callout("Question 8", "Why did you avoid frontend frameworks like React or Vite?", "NOTE")
    body("Answer: Vite and heavy frontend frameworks introduce vast dependency trees, complex build pipelines, and opaque generated code. By writing native ES Modules, semantic HTML5, and clean CSS, every single line of frontend code is human-readable, auditable, and maintainable. Furthermore, it eliminates the need for compilation steps, allowing direct browser execution and deterministic service worker pre-caching.")

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
        print(f"Generated comprehensive manual: {p_obj} ({os.path.getsize(p_obj):,} bytes)")

if __name__ == "__main__":
    project_root = Path(__file__).resolve().parent.parent
    desktop = Path.home() / "Desktop"
    if not desktop.exists():
        desktop = Path(r"C:\Desktop")
        
    outputs = [
        project_root / "docs" / "UNPLUG-Comprehensive-Development-Guide.docx",
        desktop / "UNPLUG-Comprehensive-Development-Guide.docx"
    ]
    generate_handbook(outputs)
