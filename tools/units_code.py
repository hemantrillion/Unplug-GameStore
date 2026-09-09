# Unit 7: Source Code Dissection of Core Modules

def add_code_dissections(b, repo_root):
    b.unit_header("7", "Line-by-Line Annotated Source Code Dissection")
    b.anchor("Deconstructing Every Line of Production Code",
             "To conduct an exhaustive, function-by-function audit of every module in the UNPLUG codebase.",
             "Demystifies system internals, providing complete mastery of every cryptographic call, database trigger, and sandbox routine.")

    modules = [
        ("services/database.mjs", "Relational Database Engine, WAL Configuration, and Immutability Triggers",
         "Initializes the SQLite database with WAL mode and foreign key support. Creates normalized schema tables and installs triggers that raise ABORT on any attempted update or delete of release records."),
        ("services/security.mjs", "Cryptographic Primitives, Constant-Time Comparison, Keypair Management",
         "Manages password hashing using scrypt/PBKDF2 with unique salts, constant-time buffer comparison via timingSafeEqual to prevent side-channel timing leaks, and generates ECDSA P-256 keypairs for artifact signing."),
        ("services/totp.mjs", "RFC 6238 TOTP Derivation, Dynamic Truncation, Anti-Replay Defense",
         "Implements RFC 6238 time-based one-time password verification. Decodes Base32 secret keys, computes HMAC-SHA1 over the 30-second counter, extracts the dynamic 4-bit offset, and validates tokens with anti-replay state."),
        ("services/contracts.mjs", "V8 AST Static Compilation, Manifest Validation, Size Guards",
         "Validates incoming game packages without executing hostile code. Compiles JavaScript into bytecode via V8 node:vm.Script to catch syntax errors, checks HTML file size caps, and enforces CSP declarations."),
        ("services/online.mjs", "Dual-Port Server Architecture, CORS Headers, Secure Routing",
         "Sets up dual HTTP servers on Port 3000 (Player storefront) and Port 3001 (Publisher governance console). Enforces Same-Origin Policy, security headers, and authenticated API routes."),
        ("web/sw.js", "Service Worker Lifecycle, Cache Storage, Network Interception",
         "Implements the Cache-First offline strategy. Pre-caches core application shell assets during install, cleans up obsolete cache versions on activate, and intercepts fetch requests while explicitly bypassing /api/ routes."),
        ("web/storage.js", "IndexedDB Wrapper, Transaction Lifecycles, Binary Blob Storage",
         "Wraps the browser's IndexedDB API for transaction-safe storage of game release packages. Allows offline playback by converting stored HTML strings into temporary Blob URLs bound to sandboxed iframes."),
        ("web/runtime.js", "Sandboxed Iframe Injection, PostMessage Bridge, 8-Second Watchdog",
         "Constructs the execution container for untrusted third-party games. Enforces sandbox='allow-scripts' without 'allow-same-origin', bridges events via postMessage, and manages the 8-second watchdog crash timer."),
        ("games/bounce.html", "Standalone HTML5 Mini-Game, 60fps Canvas Loop, Input Normalization",
         "Demonstrates a complete offline game payload. Features a 60fps requestAnimationFrame game loop, pointer event normalization for mouse and touch devices, collision physics, and unplug:ready messaging.")
    ]

    for rel_path, title_desc, tech_summary in modules:
        fpath = repo_root / rel_path
        b.h1(f"7.{modules.index((rel_path, title_desc, tech_summary)) + 1} Module Audit: {rel_path}")
        b.body(f"Purpose & Architectural Role: {title_desc}")
        b.body(tech_summary)
        if fpath.exists():
            content = fpath.read_text(encoding="utf-8", errors="replace")
            b.code(content)
        else:
            b.body(f"Warning: File {rel_path} was not found on local path.")
