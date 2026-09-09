"""Generate the complete, exhaustive UNPLUG Development Guide and Architecture Report as a valid .docx document."""
import os
import sys
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

def build_word_document(output_paths):
    paragraphs_xml = []

    def p_text(text, style="Normal", bold=False, color=None, font_size=None, space_after=120):
        rpr = []
        if bold:
            rpr.append("<w:b/>")
        if color:
            rpr.append(f'<w:color w:val="{color}"/>')
        if font_size:
            rpr.append(f'<w:sz w:val="{font_size}"/>')
        
        rpr_xml = f"<w:rPr>{''.join(rpr)}</w:rPr>" if rpr else ""
        ppr = f'<w:pPr><w:pStyle w:val="{style}"/><w:spacing w:after="{space_after}"/></w:pPr>'
        paragraphs_xml.append(f'<w:p>{ppr}<w:r>{rpr_xml}<w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')

    def heading_1(text):
        p_text(text, style="Heading1", bold=True, color="1E3A8A", font_size=32, space_after=200)

    def heading_2(text):
        p_text(text, style="Heading2", bold=True, color="25458C", font_size=26, space_after=140)

    def heading_3(text):
        p_text(text, style="Heading3", bold=True, color="18243B", font_size=22, space_after=100)

    def body_p(text):
        p_text(text, style="Normal", color="252C3A", font_size=22, space_after=120)

    def bullet(text, bold_prefix=None):
        ppr = '<w:pPr><w:pStyle w:val="ListBullet"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="80"/></w:pPr>'
        runs = []
        if bold_prefix:
            runs.append(f'<w:r><w:rPr><w:b/><w:color w:val="18243B"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">{escape(bold_prefix)} </w:t></w:r>')
        runs.append(f'<w:r><w:rPr><w:color w:val="252C3A"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">{escape(text)}</w:t></w:r>')
        paragraphs_xml.append(f'<w:p>{ppr}{"".join(runs)}</w:p>')

    def code_block(code_text):
        lines = code_text.strip().split("\n")
        for line in lines:
            ppr = '<w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/><w:spacing w:after="40"/><w:ind w:left="360" w:right="360"/></w:pPr>'
            rpr = '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:color w:val="0F172A"/><w:sz w:val="19"/></w:rPr>'
            paragraphs_xml.append(f'<w:p>{ppr}<w:r>{rpr}<w:t xml:space="preserve">{escape(line)}</w:t></w:r></w:p>')

    def callout_box(title, text, kind="NOTE"):
        border_color = "25458C" if kind == "NOTE" else "D97706"
        fill_color = "EFF6FF" if kind == "NOTE" else "FFFBEB"
        ppr = f'<w:pPr><w:shd w:val="clear" w:color="auto" w:fill="{fill_color}"/><w:spacing w:before="120" w:after="120"/><w:ind w:left="360" w:right="360"/><w:pBdr><w:left w:val="single" w:sz="24" w:space="12" w:color="{border_color}"/></w:pBdr></w:pPr>'
        run_title = f'<w:r><w:rPr><w:b/><w:color w:val="{border_color}"/><w:sz w:val="21"/></w:rPr><w:t xml:space="preserve">[{kind}] {escape(title)}: </w:t></w:r>'
        run_text = f'<w:r><w:rPr><w:color w:val="1F2937"/><w:sz w:val="21"/></w:rPr><w:t xml:space="preserve">{escape(text)}</w:t></w:r>'
        paragraphs_xml.append(f'<w:p>{ppr}{run_title}{run_text}</w:p>')

    def table(headers, rows):
        tbl_pr = """<w:tblPr>
            <w:tblW w:w="0" w:type="auto"/>
            <w:tblBorders>
                <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                <w:bottom w:val="single" w:sz="8" w:space="0" w:color="94A3B8"/>
                <w:left w:val="none"/>
                <w:right w:val="none"/>
                <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
                <w:insideV w:val="none"/>
            </w:tblBorders>
        </w:tblPr>"""
        
        rows_xml = []
        header_cells = []
        for h in headers:
            tc = f"""<w:tc>
                <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="244DBA"/><w:tcMar><w:top w:w="120"/><w:bottom w:w="120"/><w:left w:w="160"/><w:right w:w="160"/></w:tcMar></w:tcPr>
                <w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>{escape(h)}</w:t></w:r></w:p>
            </w:tc>"""
            header_cells.append(tc)
        rows_xml.append(f"<w:tr>{''.join(header_cells)}</w:tr>")

        for i, row in enumerate(rows):
            fill = "F8FAFC" if i % 2 == 1 else "FFFFFF"
            cells = []
            for cell in row:
                tc = f"""<w:tc>
                    <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="{fill}"/><w:tcMar><w:top w:w="100"/><w:bottom w:w="100"/><w:left w:w="160"/><w:right w:w="160"/></w:tcMar></w:tcPr>
                    <w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:color w:val="1E293B"/><w:sz w:val="20"/></w:rPr><w:t>{escape(str(cell))}</w:t></w:r></w:p>
                </w:tc>"""
                cells.append(tc)
            rows_xml.append(f"<w:tr>{''.join(cells)}</w:tr>")

        paragraphs_xml.append(f"<w:tbl>{tbl_pr}{''.join(rows_xml)}</w:tbl>")
        p_text("", space_after=140)

    # -------------------------------------------------------------
    # DOCUMENT CONTENT
    # -------------------------------------------------------------

    # Document Header / Title
    p_text("UNPLUG — THE GAME STORE", style="Title", bold=True, color="1E3A8A", font_size=48, space_after=80)
    p_text("Comprehensive Architectural Guide, Implementation Manual & System Specification", style="Subtitle", bold=False, color="475569", font_size=28, space_after=240)
    
    callout_box("Project Baseline", "7th Semester Major/Minor Engineering Project. Multi-Developer Publishing, Offline-First Game Delivery, Cryptographic Governance, and Runtime Sandboxing.", "NOTE")

    # Section 1: Executive Summary
    heading_1("Executive Summary & Core Thesis")
    body_p("UNPLUG is not a casual game app collection. It is a full-lifecycle software engineering and release governance platform designed to prove how untrusted interactive code can be built, validated, cryptographically signed, reviewed, published, monitored, and rolled back in an offline-first client architecture.")
    body_p("The mini-games included with the platform (such as Bounce, Snake, and Memory) serve as verified payloads that prove the capabilities of the underlying distribution, security, and execution engine.")

    # Section 2: Release Governance Sequence
    heading_2("1. The Release Governance Sequence")
    body_p("Every release pushed to UNPLUG undergoes a strict, unidirectional pipeline. Unlike conventional systems that trust client-submitted bundles or rebuild artifacts during deployment, UNPLUG guarantees that the exact byte-for-byte tested artifact is what gets deployed to end users:")
    
    bullet("A registered developer writes a single-file HTML5 Canvas game complying with the platform contract (<= 256 KiB, no external scripts, postMessage readiness contract).", "Step 1: Intake & Contract Validation -")
    bullet("The intake engine parses and compiles the script AST using Node's native vm.Script (without executing the code) and computes an immutable SHA-256 digest.", "Step 2: Syntax & Static Checks -")
    bullet("The release is placed into 'candidate' status. The platform generates an asymmetric ECDSA P-256 digital signature over the game content and assigns a cryptographic capability URL.", "Step 3: Cryptographic Signing -")
    bullet("An administrator or designated reviewer plays the exact candidate in a dual-port sandboxed iframe on an isolated origin (Port 3001) that has zero access to platform session cookies or storage.", "Step 4: Sandboxed Playtest -")
    bullet("The reviewer completes an interactive quality checklist (confirming gameplay, content, and control responsiveness) and submits written feedback.", "Step 5: Human Review & Approval -")
    bullet("The administrator activates the approved release by specifying an activation reason and matching the expected digest. The release pointer advances atomically in the database.", "Step 6: Atomic Activation -")
    bullet("Connected players receive the updated catalog on resume/launch. Downloaded games are cached in Cache Storage. If the network is terminated, downloaded games run indefinitely offline.", "Step 7: Offline-First Distribution -")
    bullet("If telemetry reports a startup error or regression, the administrator triggers a 1-click rollback. The deployment revision increments while restoring the older, verified digest pointer.", "Step 8: Auditable Rollback -")

    # Section 3: Core Technologies Deep Dive
    heading_1("2. Core Technologies Explained from First Principles")
    body_p("Each technology in UNPLUG was chosen deliberately to minimize third-party bloat, maximize supply-chain security, and provide deep architectural defensibility during technical evaluation.")

    heading_2("2.1 HTML5 Canvas Game Engine")
    body_p("Why HTML5 Canvas? Third-party game engines (like Unity, Phaser, or Godot exports) produce multi-megabyte bundles with hundreds of external assets, complex WebAssembly blobs, and network dependencies that make runtime isolation and automated security scanning impossible.")
    body_p("UNPLUG games use native HTML5 Canvas 2D contexts inside a single self-contained HTML file. Key architectural patterns include:")
    bullet("A fixed-timestep frame loop powered by requestAnimationFrame with delta-time clamping to prevent collision teleportation when background tabs resume.", "Deterministic Physics:")
    bullet("Decoupled state update() and draw() phases allowing exact reproduction of game state and zero asset pop-in.", "State Decoupling:")
    bullet("The parent shell controls window messaging. The child canvas notifies the container by dispatching window.parent.postMessage({type: 'unplug:ready'}, '*'). The parent verifies event.source strictly.", "Readiness Contract:")

    heading_2("2.2 RFC 6238 TOTP Multi-Factor Authentication")
    body_p("Why native RFC 6238? Traditional authentication that relies solely on passwords is insufficient for administrative release approvals. Instead of pulling in large external npm packages with supply-chain vulnerabilities, UNPLUG implements RFC 6238 TOTP natively in services/totp.mjs using Node's built-in node:crypto module.")
    body_p("How the mathematical algorithm works:")
    code_block("""// RFC 6238 time-step calculation:
const counter = Math.floor(timestamp / 30);
// HMAC-SHA1 calculation:
const hmac = crypto.createHmac('sha1', secretKey).update(counterBuffer).digest();
// Dynamic truncation (RFC 4226):
const offset = hmac[hmac.length - 1] & 0xf;
const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');""")
    body_p("Security Hardening: The database records mfa_last_step. If an attacker captures an authenticator code within its 30-second validity window, concurrent reuse is immediately blocked by rejecting any step number less than or equal to mfa_last_step.")

    heading_2("2.3 SQLite with WAL Mode and Immutability Triggers")
    body_p("Why SQLite for the local foundation? A distributed database daemon (like PostgreSQL) requires external services, network sockets, user credentials, and background connection pools that make self-contained desktop installation fragile. Node 24's native node:sqlite API provides robust ACID transactions with zero external service dependencies.")
    body_p("Immutability at the Database Layer: UNPLUG implements active defense against silent corruption or malicious tampering by compiling SQL triggers directly into the schema:")
    code_block("""CREATE TRIGGER IF NOT EXISTS release_immutable
BEFORE UPDATE OF game_id, version, html, sha256, signature, bytes, checks, created ON releases
BEGIN
    SELECT RAISE(ABORT, 'Release bytes and metadata are immutable');
END;

CREATE TRIGGER IF NOT EXISTS audit_no_update
BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT, 'Audit records are append-only'); END;

CREATE TRIGGER IF NOT EXISTS audit_no_delete
BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT, 'Audit records are append-only'); END;""")
    body_p("These triggers guarantee that even an administrator with direct SQL query capabilities cannot silently overwrite release bytes or erase the audit trail.")

    heading_2("2.4 Asymmetric Cryptography: ECDSA P-256 vs SHA-256 Checksums")
    body_p("A common novice mistake in software distribution is assuming a SHA-256 hash is a digital signature. It is not:")
    bullet("SHA-256 proves only that a file has not changed relative to a given hash string. If an attacker modifies both the file and the hash, a checksum check passes.", "SHA-256 (Integrity):")
    bullet("An Elliptic Curve Digital Signature Algorithm (ECDSA) using the NIST P-256 curve and SHA-256 hashing proves BOTH integrity and authorship. The platform signs the game using a secure private key (JWK/DER format); the client verifies the signature using the platform's public key.", "ECDSA P-256 (Authenticity):")
    body_p("Before any downloaded game is saved into browser Cache Storage, the client invokes crypto.subtle.verify() with IEEE P1363 curve formatting. Tampered games are rejected immediately.")

    # Section 4: Threat Modeling & Security Boundaries
    heading_1("3. Security Architecture & Threat Modeling")
    body_p("The fundamental challenge of any app store is running untrusted code created by third parties without endangering the host platform or other users. UNPLUG enforces security at five distinct checkpoints:")

    table(
        ["Checkpoint", "Threat Addressed", "Implemented Defense", "Verification Evidence"],
        [
            ["Intake", "Malicious scripts, external CDNs, tracking", "Single-file contract, AST compilation, tag blacklisting", "unit tests in platform.test.mjs"],
            ["Serving", "Session hijacking, cookie theft, CSRF", "Port 3001 game origin, cross-origin cookies prohibited", "Dual HTTP servers in start.mjs"],
            ["Execution", "DOM access, parent page manipulation", "iframe sandbox='allow-scripts' without allow-same-origin", "Playwright test in player.spec.mjs"],
            ["Database", "Silent release tampering, revision forging", "SQLite BEFORE UPDATE triggers & foreign key locks", "recovery.test.mjs"],
            ["Session", "Credential stuffing, brute-force attacks", "Express rate limiting (10 attempts / 15m), timingSafeEqual", "Rate limiter integration tests"]
        ]
    )

    heading_2("3.1 The Double-Nested Iframe Sandbox")
    body_p("If a game runs in the same origin as the application, it has access to document.cookie, window.localStorage, and IndexedDB. In UNPLUG, games are served from an entirely different port (GAME_PORT 3001) under a dedicated runtime-host wrapper.")
    body_p("Furthermore, the iframe enforces sandbox='allow-scripts'. Omitting 'allow-same-origin' turns the iframe into an opaque unique origin (null origin). Even if a malicious developer manages to inject an exploit, the browser's sandbox prevents it from reading parent cookies, making network requests to platform APIs, or opening popup windows.")

    # Section 5: Network Dependency vs Offline Capability
    heading_1("4. Network Dependency & Offline Capability Matrix")
    body_p("A core selling point of UNPLUG is honest offline resilience. The system explicitly defines what operates without connectivity versus what requires an active network bridge:")

    table(
        ["Platform Functionality", "Network Required?", "Offline Behavior & Strategy", "User Impact"],
        [
            ["PWA Workspace Shell", "No", "Cached via Service Worker (unplug-public-shell-v1)", "App opens instantly even on airplane mode"],
            ["Downloaded Games", "No", "Cached in dedicated Cache Storage (unplug-game-artifacts-v1)", "Full gameplay, sound, physics work offline"],
            ["Game Catalog Browsing", "Conditional", "Serves last-known catalog from localStorage if offline", "User can see and play existing library"],
            ["Catalog Updates / New Games", "Yes", "Fails gracefully with status alert; does not crash", "Catalog refreshes upon reconnection"],
            ["Game Submissions & Checks", "Yes", "Blocked offline; requires server-side validation", "Developers submit when connected"],
            ["Admin Review & Approval", "Yes", "Requires live database transaction and signature", "Governance occurs on platform server"],
            ["1-Click Rollback", "Yes", "Updates server pointer; clients discover on reconnect", "Running games not interrupted; next start updates"],
            ["Turn-based Matchmaking", "Yes", "Server-authoritative turn validation and board state", "Matchmaking queue pauses when offline"],
            ["Issue Reporting", "Conditional", "Immediate submission if online; logs error if offline", "Queued reports under Phase 10 roadmap"]
        ]
    )

    # Section 6: Monetization, Ads & Google Play Compliance
    heading_1("5. Monetization, Ads & Store Compliance Roadmap")
    body_p("To transition from a local academic project to a commercial mobile platform, specific legal, operational, and policy hurdles must be managed:")

    heading_2("5.1 Google Play Policy on Executable Code")
    body_p("Google Play's Developer Program Policy strictly regulates apps that download executable code (such as DEX, JAR, or native binaries) from external servers. However, Google explicitly allows apps that run interpreted scripts (such as JavaScript in a WebView) under the following conditions:")
    bullet("The downloaded script does not fundamentally alter the primary purpose of the application registered in the Google Play Console.", "Purpose Consistency:")
    bullet("The script is executed inside an isolated browser sandbox that cannot invoke native Android runtime APIs without explicit developer permission.", "Sandbox Isolation:")
    bullet("For commercial release, UNPLUG packages its core catalog and verified first-party games directly into the Android asset bundle (using Capacitor's native asset packing), eliminating dynamic download risk entirely for store reviewers.", "Asset Bundling Strategy:")

    heading_2("5.2 Advertising, Rewarded Hints & Revenue Share")
    body_p("UNPLUG's business model is designed around privacy-preserving monetization that rewards both the platform and independent game creators:")
    bullet("Players who reach difficult game states can optionally click 'Watch Ad for Hint'. The platform verifies ad completion via server-side callbacks before granting the hint.", "Rewarded Hints:")
    bullet("A one-time in-app purchase ($1.99) or subscription ($0.99/month) grants an ad-free entitlement token linked to the user account.", "Paid Ad Removal:")
    bullet("Ad impressions and hint requests are cryptographically attributed to the specific game's developer ID. An append-only revenue ledger records platform fee (e.g., 30%) and developer payout (70%) with automated payout thresholds via Stripe Connect.", "Developer Attribution & Ledger:")

    # Section 7: File and Folder Map
    heading_1("6. Exhaustive File and Directory Map")
    body_p("The following table details the responsibility and architectural boundary of every file in the UNPLUG codebase:")

    table(
        ["File / Folder Path", "Architectural Role & Layer", "Key Responsibilities & Technologies"],
        [
            ["services/server.mjs", "Backend HTTP Entrypoint", "Initializes Express, configures CORS, rate limits, dual HTTP listeners"],
            ["services/app.mjs", "Core API & Business Logic", "Implements authentication, submissions, review, activation, reports, artifacts"],
            ["services/database.mjs", "Data Layer & Migrations", "SQLite database connection, schema v1-v3, immutability triggers, WAL setup"],
            ["services/security.mjs", "Cryptographic Operations", "ECDSA P-256 key generation, artifact signing, SHA-256 hashing, timingSafeEqual"],
            ["services/totp.mjs", "Multi-Factor Authentication", "Native RFC 6238 TOTP computation, HMAC-SHA1, replay window protection"],
            ["services/online.mjs", "Turn-based Multiplayer", "Turn validation, board state tracking, winner calculation, replay defense"],
            ["services/contracts.mjs", "Intake Validation", "HTML5 game contract enforcement, AST syntax parsing, tag restrictions"],
            ["web/index.html", "Single-Page Application Shell", "Semantic markup for Discover, Library, Developer Studio, and Admin Console"],
            ["web/app.js", "Client Orchestration", "Frontend state management, API requests, CSRF handling, Web Crypto verification"],
            ["web/styles.css", "Modern Light UI Theme", "Responsive grid layout, accessible contrast, CSS variables, mobile media queries"],
            ["web/runtime-host.html", "Isolated Game Container", "Double-nested iframe container binding to port 3001 sandbox"],
            ["web/runtime.js", "Sandbox Communication", "postMessage listener, readiness timeout handler, lifecycle cleanup"],
            ["web/storage.js", "Offline Cache Manager", "Interacts with Cache Storage and localStorage for offline catalog & game persistence"],
            ["web/sw.js", "Service Worker", "Caches UI application shell files for zero-network instant cold start"],
            ["apps/desktop/main.cjs", "Electron Desktop Main", "Desktop window lifecycle, local server bootstrap, secure window settings"],
            ["apps/desktop/package.json", "Desktop Packaging Config", "NSIS installer configuration for Windows x64 standalone distribution"],
            ["apps/android/capacitor.config.json", "Capacitor Mobile Config", "Package ID, Android scheme, native webview security parameters"],
            ["games/bounce.html", "First-Party Canvas Game", "Paddle-and-ball physics, collision math, score tracking, readiness contract"],
            ["games/snake.html", "First-Party Canvas Game", "Grid-based movement, food generation, self-collision detection"],
            ["games/memory.html", "First-Party Canvas Game", "Card matching logic, state tracking, visual flip animations"],
            ["tests/platform.test.mjs", "Platform Integration Tests", "8 automated tests covering review, rollback, CSRF, MFA, and backups"],
            ["tests/browser/player.spec.mjs", "End-to-End Browser Tests", "Playwright tests verifying admin approval, offline cold-reload, and mobile UI"],
            ["tools/check.mjs", "Static Syntax Linter", "Recursive node --check runner across all JavaScript and module files"],
            ["tools/backup.mjs", "Disaster Recovery Backup", "Dumps SQLite database, signing keys, and game artifacts to archive"],
            ["tools/restore.mjs", "Disaster Recovery Restore", "Restores database and cryptographic keys to clean environment"],
            ["tools/package-release.mjs", "CLI Packaging Tool", "Packages local HTML games into signed release payloads with SHA-256 digests"],
            ["tools/stage-release.mjs", "CLI Staging Tool", "Submits packaged releases to local or remote CI endpoints"],
            ["tools/build-docs.py", "Documentation Generator", "Generates this complete OpenXML Word development manual"]
        ]
    )

    # Section 8: Acceptance & Verification
    heading_1("7. System Acceptance & Testing Playbook")
    body_p("To prove that the platform is operational, verified, and free of regressions, execute the following commands in the project root:")
    code_block("""# 1. Check all JavaScript syntax, manifests, and game contracts
npm run check

# 2. Execute all platform integration tests (MFA, RBAC, Immutability, Rollback)
npm test

# 3. Run Playwright end-to-end browser tests (including offline cold-reload)
npm run test:browser

# 4. Generate the full Word development manual
npm run docs

# 5. Start the local server
npm start""")
    body_p("When npm start is executed, access the platform at http://127.0.0.1:3000. Use admin@unplug.local and the password specified in your local .env to access the full administration and review dashboard.")

    # -------------------------------------------------------------
    # PACKAGING INTO OPENXML (.DOCX)
    # -------------------------------------------------------------
    body_xml = "".join(paragraphs_xml)
    
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
<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="252C3A"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Title">
<w:name w:val="Title"/><w:basedOn w:val="Normal"/>
<w:rPr><w:b/><w:sz w:val="48"/><w:color w:val="1E3A8A"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="Subtitle">
<w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/>
<w:rPr><w:sz w:val="26"/><w:color w:val="64748B"/></w:rPr>
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
<w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="18243B"/></w:rPr>
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
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(p, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("[Content_Types].xml", content_types)
            archive.writestr("_rels/.rels", package_rels)
            archive.writestr("word/document.xml", document_xml)
            archive.writestr("word/styles.xml", styles_xml)
            archive.writestr("word/_rels/document.xml.rels", document_rels)
        print(f"Generated Word document: {p}")

if __name__ == "__main__":
    project_root = Path(__file__).resolve().parent.parent
    desktop = Path.home() / "Desktop"
    if not desktop.exists():
        desktop = Path(r"C:\Desktop")
        
    outputs = [
        project_root / "docs" / "UNPLUG-Comprehensive-Development-Guide.docx",
        desktop / "UNPLUG-Comprehensive-Development-Guide.docx"
    ]
    build_word_document(outputs)
