# Unit 1 and Unit 2: Philosophy and Mental Models

def add_philosophy_and_models(b, source_dir):
    # UNIT 1: FOUNDATION & PHILOSOPHY
    b.unit_header('1', 'The Pedagogical Foundation, Character Sketch, and Project Philosophy')
    b.anchor('Reflective Systems Thinking vs. Blind Execution',
             'To establish why UNPLUG was engineered from first principles without AI boilerplates, Vite, or opaque frameworks.',
             'Prevents building brittle, un-auditable software that fails silently in production due to hidden supply-chain dependencies.')

    b.h1('1.1 The Engineer\'s Character Sketch: The Reflective Strategist')
    b.body('Most computer science curricula encourage students to become pure executors: \'Here is a ticket, write a quick React frontend, connect an Express backend, deploy to Vercel, and move on.\' But true senior engineering and systems architecture demand a fundamentally different mindset: reflective strategy.')
    b.body('A reflective strategist does not accept a tool simply because it is popular. They ask fundamental questions: Why does this system exist? What are its failure domains? Where is the control plane? How can the architecture be simplified so that every byte executed can be audited by a human?')

    b.h1('1.2 Strategic Career Mapping: Roles Aligned with First-Principles Thinking')
    b.bullet('Cloud Solutions Architect:', 'Designing resilient, highly available cloud backends with immutable audit trails, multi-region failover, and strict defense-in-depth isolation.')
    b.bullet('Systems & Security Engineer:', 'Auditing runtime boundaries, enforcing Content Security Policies, implementing cryptographic verification (P-256, TOTP, SHA-256), and eliminating timing side-channels.')
    b.bullet('Technical Product Strategist:', 'Navigating platform policy, regulatory compliance (SOC 2, ISO 27001), app store distribution governance, and offline user requirements.')

    b.h1('1.3 The Core Philosophy: Why We Rejected Vite, React, and AI-Generated Boilerplate')
    b.mental_model('The Prefabricated Dollhouse vs. The Steel Frame Foundation',
                   'If you buy a plastic toy dollhouse and stack it, you have a structure in five minutes, but you cannot inspect the load-bearing pillars, and the first storm will destroy it. If you assemble steel beams with inspected bolts, it takes careful engineering, but it will stand for a hundred years.',
                   'Vite, Webpack, and AI-generated React templates generate thousands of hidden dependencies in node_modules before you write a single line of business logic. UNPLUG uses standard ECMAScript modules, vanilla HTML5 Canvas, and native Web APIs so that 100% of the codebase is transparent, human-auditable, and permanent.')

    b.case_study('The CrowdStrike Global Outage (July 19, 2024)',
                 'CrowdStrike deployed Channel File 291 to 8.5 million Windows computers worldwide. A logic error in the sensor configuration triggered an out-of-bounds memory read (BSOD loop). Because the update bypassed a phased canary rollout, lacked automated runtime health sandboxing, and had no single-click rollback mechanism, global airlines, hospitals, and financial systems were paralyzed for days.',
                 'UNPLUG eliminates this entire class of disasters: (1) All incoming game releases undergo static V8 AST compilation in a dry-run VM before acceptance, (2) Third-party code executes strictly inside a sandboxed iframe with connect-src \'none\', (3) An 8-second watchdog timer monitors client execution and flags failing games, and (4) The publisher console provides an instant, sub-second rollback that repoints the catalog to the last known healthy release without rebuilding or redeploying code.')

    b.case_study('The SolarWinds Orion Supply-Chain Attack',
                 'Attackers compromised SolarWinds\' build system and injected the Sunburst backdoor into authentic software updates. Millions of downstream clients downloaded the update because its SHA-256 hash matched the vendor manifest. However, the hash only proved that the file was unchanged after compilation; it did not verify code origin or runtime containment.',
                 'UNPLUG separates digest integrity (SHA-256) from cryptographic provenance (NIST P-256 ECDSA digital signatures). Every game package is signed with a private key, verified with an asymmetric public key before execution, and restricted by strict CSP sandboxing so that even if untrusted code runs, it cannot exfiltrate data or communicate with external command-and-control servers.')

    guide_file = source_dir / 'guide minor project.txt'
    if guide_file.exists():
        b.h1('1.4 Synthesis of Foundational Project Guidelines & Character Reflections')
        b.stream_text(guide_file.read_text(encoding='utf-8', errors='replace'))

    # UNIT 2: PHYSICAL MENTAL MODELS
    b.unit_header('2', 'Physical Mental Models & 8th-Grade Intuition')
    b.anchor('Grounding Abstract CS Concepts in Physical Reality',
             'To provide clear, tangible mental models for cryptographic signing, sandboxing, multi-factor auth, and offline caching.',
             'Prevents rote memorization without conceptual understanding, enabling students to explain complex architectures during oral viva defense.')

    b.mental_model('The Tamper-Evident Wax Seal vs. The Cash Register Receipt (Signatures vs. Checksums)',
                   'A supermarket cash register receipt lists the items you bought and prints a total at the bottom. If you drop the receipt on the floor and compare the printed total to your bag, you can tell if an item fell out (Integrity). But anyone with a thermal printer can fake that receipt! A royal wax seal, however, is stamped with the king\'s unique signet ring. Only the king has the ring (Private Key). Anyone who sees the unbroken seal knows it came from the king and hasn\'t been opened (Authenticity & Provenance).',
                   'A SHA-256 checksum is like the receipt: it only tells you if a byte changed. An ECDSA P-256 signature is like the wax seal: it mathematically proves that the release was signed by the legitimate publisher and has not been tampered with.')

    b.mental_model('The Bank Vault with Two Tellers (Dual-Port Origin Separation)',
                   'Imagine a bank with two separate teller windows on opposite sides of the building. Window A (Port 3000) is open to the public street and gives people amusement tickets. Window B (Port 3001) is inside a secured courtyard behind a locked security gate where the bank manager manages safe deposits. Even if a pickpocket steals a ticket at Window A, they cannot reach Window B because there is a physical brick wall between them.',
                   'Browsers enforce the Same-Origin Policy (SOP). An origin is defined by (Protocol, Host, Port). Port 3000 and Port 3001 are treated as completely different planets. Even if an attacker executes arbitrary JavaScript on the player store (Port 3000), the browser forbids that script from reading cookies, localStorage, or API responses from the publisher console (Port 3001).')

    b.mental_model('The Double Glass Box (Sandboxed Iframes with connect-src \'none\')',
                   'Imagine a scientist examining a live, potentially poisonous spider. The scientist does not let the spider crawl on their desk. First, they put the spider inside a sealed glass jar (Iframe Sandbox with allow-scripts). Second, they place the jar inside a sealed biocontainment chamber with air filters and no doors to the outside world (Content Security Policy connect-src \'none\'). The spider can walk around inside the jar (the game plays smoothly), but it cannot bite the scientist (access cookies/DOM) and cannot signal outside insects (network exfiltration).',
                   'UNPLUG renders untrusted HTML5 games inside an iframe with sandbox=\'allow-scripts\' without \'allow-same-origin\'. Furthermore, the CSP header connect-src \'none\' blocks fetch(), XMLHttpRequest, WebSocket, and WebRTC, totally isolating the game runtime.')

    b.mental_model('The Rotating Safe Combination (RFC 6238 Time-Based One-Time Passwords)',
                   'Imagine a high-security safe where the combination lock changes automatically every 30 seconds. Both the safe and the bank manager have identical synchronized pocket watches and a shared secret word. Every 30 seconds, both use the current minute and the secret word to calculate a temporary 6-digit number. If a spy watches the manager enter the code and types it in 40 seconds later, the safe remains locked because the combination has already expired.',
                   'RFC 6238 TOTP calculates T = floor((CurrentUnixTime - 0) / 30). It runs an HMAC hash of T with the publisher\'s secret key, truncates the result to a 6-digit number, and rejects any code used more than once by recording mfa_last_step in the SQLite database.')

    b.mental_model('The Railroad Switch Track (Monotonic Deployment Revisions & Instant Rollback)',
                   'Imagine a train line leading into a train station. Instead of tearing up the tracks, rebuilding the station, and laying down new ties when a train engine malfunctions, the railroad switchman simply pulls a mechanical lever (the switch track) to direct incoming trains back to Track 1 (the known good train). The switch takes less than one second.',
                   'UNPLUG treats every uploaded game release as an immutable, permanent artifact in the releases table. The deployments table simply holds a pointer (active_release_id) and a monotonic revision counter (1, 2, 3...). When a release fails, the publisher does not rebuild code; they click \'Activate 1.0.0\', advancing revision from 2 to 3 and pointing the switch back to 1.0.0 in milliseconds.')

    b.mental_model('The Island with No Ship Traffic (Offline-First Service Worker & Cache Storage)',
                   'Imagine an island community that prepares for winter by stocking a massive food pantry. When winter comes and the ocean freezes over, stopping all cargo ships from the mainland, the islanders don\'t starve—they open the pantry and live comfortably. When spring arrives and ships return, they check for fresh supplies and restock the pantry.',
                   'A Service Worker acts as an in-browser proxy. During the install phase, it fetches all HTML, CSS, JavaScript, and icons into Cache Storage. When the player disconnects from the internet or restarts their device in airplane mode, the Service Worker intercepts every fetch request and instantly serves the cached files from the pantry.')
