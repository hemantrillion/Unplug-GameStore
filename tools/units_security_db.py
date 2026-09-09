# Units 3 to 6: Cryptography, Database, Runtime Isolation, and Offline Architecture

def add_security_and_storage(b):
    # UNIT 3: CRYPTOGRAPHY & SECURITY
    b.unit_header("3", "Cryptography & Security Engineering Mechanics")
    b.anchor("Mathematical Rigor in Hashing, Signatures, and MFA",
             "To understand the exact binary, elliptic curve, and hashing mechanics behind SHA-256, ECDSA P-256, constant-time comparisons, and RFC 6238 TOTP.",
             "Prevents insecure implementations, replay vulnerabilities, side-channel timing leaks, and counterfeit game execution.")

    b.h1("3.1 SHA-256 Digest Integrity: Mathematics and Properties")
    b.body("SHA-256 (Secure Hash Algorithm 256-bit) is a cryptographic hash function published in NIST FIPS PUB 180-4. It operates on arbitrary-length binary inputs and produces a fixed-size 256-bit (32-byte, 64-hex-character) output digest.")
    b.bullet("Preprocessing & Padding:", "The message M is padded so that its length in bits is congruent to 448 modulo 512. Padding begins with a single '1' bit, followed by k '0' bits, followed by a 64-bit big-endian integer representing the original message length.")
    b.bullet("Message Blocks:", "The padded message is divided into N sequential 512-bit blocks (M_1, M_2, ..., M_N). Each block is expanded into 64 32-bit words (W_0 through W_63).")
    b.bullet("Compression Rounds:", "Each 512-bit block undergoes 64 rounds of non-linear mixing using eight working state variables (a through h), initialized to the square roots of the first eight prime numbers. Each round applies bitwise rotations, XOR operations, modular addition (modulo 2^32), and round constants K_t derived from the cube roots of the first 64 prime numbers.")
    b.bullet("Avalanche Effect:", "Flipping a single bit in the input message causes an average of 50% of the output digest bits to flip unpredictably, guaranteeing collision resistance and pre-image resistance.")

    b.h1("3.2 NIST P-256 (secp256r1) Elliptic Curve Cryptography: Authenticity and Provenance")
    b.body("Asymmetric digital signatures solve the provenance problem by using a mathematically linked key pair: a private signing key d (kept secret by the publisher) and a public verification key Q (distributed to all players).")
    b.body("The NIST P-256 curve is defined over the prime Galois field GF(p), where:")
    b.code("p = 2^256 - 2^224 + 2^192 + 2^96 - 1")
    b.body("The curve equation in short Weierstrass form is:")
    b.code("y^2 = x^3 - 3x + b (mod p)")
    b.body("The Elliptic Curve Discrete Logarithm Problem (ECDLP) guarantees security: Given the base generator point G and the public key Q = d * G, it is computationally infeasible to compute the private scalar d using known algorithms in sub-exponential time.")

    b.h1("3.3 Constant-Time Comparison and Timing Side-Channel Defense")
    b.body("When authenticating users with passwords or verifying session tokens, standard string equality operators compare strings byte-by-byte from left to right, returning false as soon as the first mismatched byte is encountered. An attacker who measures network response latencies with high-precision timers can deduce the correct password byte-by-byte.")
    b.security_alert("Timing Side-Channel Attacks on Authentication",
                     "Variable-time string comparisons leak secret credentials through execution timing variances.",
                     "UNPLUG uses crypto.timingSafeEqual() in Node.js. It executes a constant-time XOR loop across all bytes regardless of where mismatches occur, preventing timing leakage.")

    b.h1("3.4 RFC 6238 Time-Based One-Time Password (TOTP) Mechanics")
    b.body("TOTP is defined in IETF RFC 6238 as an extension of HMAC-Based One-Time Passwords (HOTP, RFC 4226).")
    b.bullet("Time Step Calculation:", "C = floor((CurrentUnixTime - 0) / 30) where 30 seconds is the time step interval.")
    b.bullet("Base32 Decoding:", "The shared secret K is decoded from Base32 (RFC 4648) into a raw 20-byte buffer.")
    b.bullet("HMAC Calculation:", "Compute HMAC-SHA1 digest over the 8-byte big-endian representation of C.")
    b.bullet("Dynamic Truncation:", "Extract lower 4 bits of byte 19 as offset O (0 <= O <= 15). Extract 4 bytes starting at O, clear the most significant bit, and parse as a 31-bit unsigned integer. Code = (BinaryCode mod 1,000,000).")
    b.bullet("Anti-Replay Defense:", "Persist mfa_last_step in SQLite. Reject any code submitted with step <= mfa_last_step.")

    # UNIT 4: DATABASE & ACID
    b.unit_header("4", "Database Architecture & Relational Governance")
    b.anchor("Relational Governance, ACID Guarantees, and Immutability Triggers",
             "To design a zero-daemon, fully portable, ACID-compliant relational store that mathematically enforces audit history immutability.",
             "Prevents database corruption, history tampering, phantom deployments, and foreign-key orphaned state.")

    b.h1("4.1 Why SQLite in WAL Mode Over PostgreSQL for Portable Evaluation")
    b.body("UNPLUG uses SQLite with Write-Ahead Logging (WAL) enabled (PRAGMA journal_mode = WAL). WAL mode allows concurrent readers without blocking writes, provides single-file portability, and guarantees full ACID transactions.")

    b.h1("4.2 Relational Schema Definition")
    b.table(
        ["Table Name", "Primary Key", "Key Foreign Keys", "Core Responsibilities"],
        [
            ["publishers", "id (INTEGER)", "None", "Stores publisher credentials, hashed passwords, MFA secrets, and mfa_last_step."],
            ["releases", "id (TEXT UUID)", "publisher_id -> publishers(id)", "Immutable registry of all game releases, hashes, signatures, and manifests."],
            ["deployments", "id (INTEGER CHECK id=1)", "active_release_id -> releases(id)", "Single-row state machine tracking active release, monotonic revision, and rollback reasons."],
            ["telemetry_events", "id (INTEGER AUTO)", "release_id -> releases(id)", "Append-only audit log tracking game launches, crashes, watchdog timeouts, and scores."]
        ]
    )

    b.h1("4.3 The SQL Immutability Trigger Pattern")
    b.body("UNPLUG enforces audit trail immutability directly in SQLite:")
    b.code("""CREATE TRIGGER IF NOT EXISTS trg_releases_prevent_update
BEFORE UPDATE ON releases
BEGIN
    SELECT RAISE(ABORT, 'Release records are immutable and cannot be updated');
END;

CREATE TRIGGER IF NOT EXISTS trg_releases_prevent_delete
BEFORE DELETE ON releases
BEGIN
    SELECT RAISE(ABORT, 'Release records are immutable and cannot be deleted');
END;""")

    # UNIT 5: RUNTIME ISOLATION & WEB SECURITY
    b.unit_header("5", "Runtime Isolation & The Web Security Architecture")
    b.anchor("Origin Isolation, CSP Enforcement, and Sandboxed Runtime Containment",
             "To prove how UNPLUG safely executes completely untrusted third-party HTML5 code without risking the host platform or user system.",
             "Prevents Cross-Site Scripting (XSS), token exfiltration, cryptomining, local storage theft, and malicious frame navigation.")

    b.h1("5.1 The Same-Origin Policy (SOP) and Dual-Port Separation")
    b.body("UNPLUG runs two distinct HTTP servers: Port 3000 (Player Storefront & Runtime) and Port 3001 (Publisher Governance Console). Under SOP, scripts executing on Port 3000 cannot inspect Port 3001 cookies, localStorage, or administrative endpoints.")

    b.h1("5.2 Content Security Policy (CSP) Directives")
    b.code("Content-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-ancestors 'self';")
    b.body("connect-src 'none' completely disables fetch(), XMLHttpRequest, WebSocket, and EventSource, preventing external data exfiltration.")

    b.h1("5.3 Double-Nested Iframe Sandboxing")
    b.body("The game iframe is configured strictly with sandbox='allow-scripts'. Omitting allow-same-origin forces the game into an opaque unique null origin, preventing DOM access to the player application.")

    b.h1("5.4 The PostMessage JSON-RPC Bridge and 8-Second Crash Watchdog")
    b.body("Games communicate solely via postMessage (unplug:ready, unplug:score, unplug:error). In web/runtime.js, an 8-second watchdog timer terminates the iframe and reports telemetry if a game hangs or fails to start.")

    # UNIT 6: OFFLINE-FIRST CLIENT ARCHITECTURE
    b.unit_header("6", "Offline-First Engineering & Client Architecture")
    b.anchor("Service Worker Caching, IndexedDB Storage, and Zero-Dependency PWA",
             "To construct a client architecture that guarantees instant sub-5ms cold starts in total network isolation (airplane mode).",
             "Prevents white-screen loading failures, stale cache deadlocks, and session leakage in browser caches.")

    b.h1("6.1 The Service Worker Lifecycle and API Route Bypassing")
    b.body("During installation, the Service Worker pre-caches the application shell into Cache Storage. During fetch events, it serves static assets Cache-First in <5ms. Requests starting with /api/ are explicitly bypassed to protect sensitive sessions.")

    b.h1("6.2 IndexedDB Storage Engine for Game Packages")
    b.body("Individual game packages are stored in client IndexedDB. Offline execution converts the stored HTML string into a Blob URL (URL.createObjectURL(blob)) bound to the sandboxed iframe.")
