"""UNPLUG Master Architectural Textbook and Complete Engineering Manual Generator.

Generates an exhaustive, multi-unit textbook and system manual in OpenXML .docx format.
Synthesizes all foundational design materials, full hands-on instructions (Phases 1-9),
code dissections, mathematical proofs, mental models, case studies, and a 30-question
viva-voce companion into a publication-grade engineering reference manual.
"""
import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tools.doc_core import DocxBuilder
from tools.units_meta import add_metadata
from tools.units_philosophy import add_philosophy_and_models
from tools.units_security_db import add_security_and_storage
from tools.units_code import add_code_dissections
from tools.units_viva import add_viva_defense

sys.stdout.reconfigure(encoding="utf-8")

def build_master_manual():
    print("Starting Master Engineering Textbook compilation...")
    b = DocxBuilder()
    source_dir = Path(r"C:\Users\jai18\AppData\Local\Temp\opencode")
    repo_root = Path(__file__).resolve().parent.parent

    # Metadata and Title Page
    print("1/7 Adding metadata and executive declaration...")
    add_metadata(b)

    # Unit 1 & Unit 2: Philosophy and Mental Models
    print("2/7 Adding Unit 1 & Unit 2 (Philosophy, Pedagogy, Real-World Case Studies, Mental Models)...")
    add_philosophy_and_models(b, source_dir)

    # Unit 3 to Unit 6: Cryptography, Database, Sandbox, Offline Architecture
    print("3/7 Adding Unit 3 to Unit 6 (Cryptography, Database WAL, Iframe Sandboxing, Offline Storage)...")
    add_security_and_storage(b)

    # Unit 7: Source Code Walkthroughs
    print("4/7 Adding Unit 7 (Line-by-Line Annotated Source Code Dissections)...")
    add_code_dissections(b, repo_root)

    # Unit 8: Phase 1 Hands-On Guide
    print("5/7 Adding Unit 8 to Unit 11 (Phases 1 through 9 Hands-On Implementation Guides)...")
    b.unit_header("8", "Phase 1: Local Environment, Project Skeleton, and Verification Baseline")
    b.anchor("Establishing the Engineering Foundation",
             "To set up the verified local workspace, toolchain prerequisites, directory hierarchy, baseline HTTP server, and automated unit test runner.",
             "Prevents configuration drift, missing dependencies, and unverified initial commits.")
    p1_file = source_dir / "minor project phase 1 developement plan.txt"
    if p1_file.exists():
        b.stream_text(p1_file.read_text(encoding="utf-8", errors="replace"))

    # Unit 9: Phases 2 & 3 Hands-On Guide
    b.unit_header("9", "Phases 2 & 3: Playable Game, Relational Schema, and Publisher Authentication")
    b.anchor("Building the Demonstration Payload and Governance Core",
             "To build the Bounce canvas mini-game, configure SQLite schema, establish password hashing with salt, and onboard RFC 6238 TOTP MFA.",
             "Prevents payload-runtime impedance mismatch and unauthenticated access.")
    p23_file = source_dir / "phase 2 and 3 minor p.txt"
    if p23_file.exists():
        b.stream_text(p23_file.read_text(encoding="utf-8", errors="replace"))

    # Unit 10: Phases 4, 5 & 6 Hands-On Guide
    b.unit_header("10", "Phases 4, 5 & 6: Offline Delivery, Package Intake, Activation & Verified Rollback")
    b.anchor("Proving Safe Release Lifecycle and Disaster Recovery",
             "To implement the publisher UI, package packaging tool, V8 AST dry-run validator, live telemetry, and execute the sub-second Emergency Rollback Drill.",
             "Prevents broken releases from taking down player devices and proves disaster recovery under examiner inspection.")
    p456_file = source_dir / "phase 4 ,5 and 6.txt"
    if p456_file.exists():
        b.stream_text(p456_file.read_text(encoding="utf-8", errors="replace"))

    # Unit 11: Phases 7, 8 & 9 Hands-On Guide
    b.unit_header("11", "Phases 7, 8 & 9: CI/CD Automation, Native Android APK, Desktop NSIS, Launch Gates")
    b.anchor("Automating Delivery and Compiling Multi-Platform Native Binaries",
             "To configure GitHub Actions CI, build native Android APK via Capacitor 7 / Gradle, compile Windows x64 NSIS installer via Electron, and complete the production launch audit.",
             "Prevents untested code from reaching production and satisfies multi-platform delivery requirements.")
    p789_file = source_dir / "minor proj pahse 7 8 9.txt"
    if p789_file.exists():
        b.stream_text(p789_file.read_text(encoding="utf-8", errors="replace"))

    inst_file = source_dir / "instrcution file.txt"
    if inst_file.exists():
        b.h1("11.5 Exhaustive Hands-On Engineering Log & Troubleshooting Archive")
        b.stream_text(inst_file.read_text(encoding="utf-8", errors="replace"))

    # Unit 12: Master Viva-Voce Companion
    print("6/7 Adding Unit 12 (30-Question Master Viva-Voce Defense Companion)...")
    add_viva_defense(b)

    # Save outputs
    print("7/7 Packaging OpenXML archive and saving master documents...")
    desktop = Path.home() / "Desktop"
    if not desktop.exists():
        desktop = Path(r"C:\Desktop")

    output_paths = [
        repo_root / "docs" / "UNPLUG-Comprehensive-Development-Guide.docx",
        desktop / "UNPLUG-Comprehensive-Development-Guide.docx"
    ]
    b.save(output_paths)
    print("Master architectural textbook and manual generation completed successfully!")

if __name__ == "__main__":
    build_master_manual()
