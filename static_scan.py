"""
static_scan.py — ChainGuard static analysis layer
Runs before Gemini/Antigravity as a fast pre-filter.

Two layers:
  1. Regex scan   — milliseconds, zero deps, catches obvious patterns
  2. Slither      — optional, requires slither-analyzer + solc installed
                    gracefully skipped if not available

Findings are injected into the Gemini prompt to guide the AI analysis.
"""

import re
import subprocess
import json
from typing import List, Dict

# ─── Pattern library ──────────────────────────────────────────────────────────
# (regex, severity, name, description)

PATTERNS = [
    # ── Critical: direct fund drain paths ────────────────────────────────────
    (r'\bselfdestruct\s*\(',
     'HIGH', 'selfdestruct',
     'Contract can self-destruct and drain all ETH to an arbitrary address'),

    (r'\brecoverTokens?\s*\(|recoverERC20\s*\(|withdrawStuckTokens?\s*\(',
     'HIGH', 'recover-tokens',
     'Owner can extract any token held by the contract'),

    (r'\bwithdrawAll\s*\(|drainFunds?\s*\(',
     'HIGH', 'withdraw-all',
     'Owner-callable function drains entire balance'),

    (r'\bfunction\s+mint\b(?![^)]*cap|[^)]*max)',
     'HIGH', 'uncapped-mint',
     'mint() function with no visible supply cap — owner can inflate supply'),

    # ── Honeypot patterns ─────────────────────────────────────────────────────
    (r'(require|revert)\s*\([^)]*\b(whitelist|approved|isAllowed)\b',
     'HIGH', 'transfer-whitelist',
     'Transfer blocked unless sender/receiver is whitelisted — honeypot pattern'),

    (r'_transfer[^}]*\bif\b[^}]*\b(blacklist|isBlacklisted|_isBlacklisted)\b',
     'HIGH', 'blacklist-transfer-block',
     '_transfer checks a blacklist — can trap buyers'),

    (r'\b_sellTax\s*=\s*[1-9]\d{2,}|\bsellTax\s*>\s*9[0-9]',
     'HIGH', 'extreme-sell-tax',
     'Sell tax appears to be >= 90% — effective honeypot'),

    # ── Rug pull patterns ─────────────────────────────────────────────────────
    (r'\bpause\(\)|whenPaused\b',
     'MEDIUM', 'pausable',
     'Owner can pause all transfers at any time'),

    (r'\bsetTax\s*\(|\bsetFee\s*\(|\bupdateTax\s*\(|\bsetBuyTax\b|\bsetSellTax\b',
     'MEDIUM', 'mutable-tax',
     'Tax/fee can be changed by owner after deployment — rug vector'),

    (r'\bblacklist\s*\[|\baddToBlacklist\s*\(|\b_blacklist\[',
     'MEDIUM', 'blacklist',
     'Blacklist mechanism — owner can freeze specific wallets'),

    (r'\btransferOwnership\s*\(address\s*\(0\)',
     'LOW', 'renounce-ownership',
     'Ownership renounced — upgrades/pausing no longer possible (positive signal)'),

    # ── Code quality / obfuscation ────────────────────────────────────────────
    (r'\bdelegatecall\s*\(',
     'HIGH', 'delegatecall',
     'delegatecall executes arbitrary external code in local context'),

    (r'\btx\.origin\b',
     'MEDIUM', 'tx-origin',
     'tx.origin used for auth — phishing attack vector'),

    (r'\bassembly\s*\{',
     'MEDIUM', 'inline-assembly',
     'Inline assembly reduces auditability and may hide malicious logic'),

    (r'\.call\s*\{[^}]*value\s*:|\.call\.value\s*\(',
     'HIGH', 'low-level-call',
     'Low-level .call with value — potential reentrancy if state not updated first'),

    # ── Upgrade / proxy patterns ──────────────────────────────────────────────
    (r'\bupgradeTo\s*\(|\b_implementation\b|\bUUPS\b|\bTransparentUpgradeableProxy\b',
     'LOW', 'upgradeable-proxy',
     'Upgradeable proxy — contract logic can be replaced by owner'),

    # ── Time-bomb / hidden logic ──────────────────────────────────────────────
    (r'block\.timestamp\s*[><=!]+\s*\d{9,}',
     'MEDIUM', 'hardcoded-timestamp',
     'Hardcoded timestamp in logic — potential time-bomb activation condition'),

    (r'\bblock\.number\s*[><=]+\s*\d{5,}',
     'MEDIUM', 'block-number-gate',
     'Logic gated on a specific block number — hidden activation trigger'),
]


def quick_scan(source_code: str) -> List[Dict]:
    """Regex-based scan. Runs in <10ms on any source."""
    findings = []
    seen = set()
    for pattern, severity, name, description in PATTERNS:
        if name not in seen and re.search(pattern, source_code, re.IGNORECASE | re.DOTALL):
            findings.append({'severity': severity, 'name': name, 'description': description})
            seen.add(name)
    return findings


def run_slither(filepath: str) -> List[Dict]:
    """
    Run Slither if available. Silently returns [] on any failure.
    Requires: pip install slither-analyzer  +  solc installed via solc-select.
    """
    try:
        result = subprocess.run(
            ['slither', filepath, '--json', '-', '--no-fail-pedantic'],
            capture_output=True, text=True, timeout=45,
        )
        if not result.stdout.strip():
            return []
        data = json.loads(result.stdout)
        findings = []
        seen = set()
        for det in data.get('results', {}).get('detectors', []):
            impact = det.get('impact', '')
            if impact in ('High', 'Medium') and det.get('check') not in seen:
                findings.append({
                    'severity': impact.upper(),
                    'name': det.get('check', 'unknown'),
                    'description': det.get('description', '')[:180].replace('\n', ' '),
                })
                seen.add(det.get('check'))
        return findings
    except (FileNotFoundError, subprocess.TimeoutExpired, json.JSONDecodeError, Exception):
        return []


def analyze(source_code: str, filepath: str = None) -> Dict:
    """
    Full static analysis pass. Returns a dict with:
      - findings: merged list from regex + Slither
      - high / medium / low: filtered sublists
      - preliminary_score: 0-60 (capped — Gemini decides final score)
      - slither_used: bool
      - prompt_context: formatted string to inject into Gemini prompt
    """
    regex_findings = quick_scan(source_code)

    slither_findings = []
    if filepath:
        slither_findings = run_slither(filepath)
        print(f"[SCAN] Slither: {len(slither_findings)} finding(s)")

    # Merge by name (regex first, Slither can add new ones)
    merged: Dict[str, Dict] = {f['name']: f for f in regex_findings}
    for f in slither_findings:
        if f['name'] not in merged:
            merged[f['name']] = f

    findings = list(merged.values())
    high   = [f for f in findings if f['severity'] == 'HIGH']
    medium = [f for f in findings if f['severity'] == 'MEDIUM']
    low    = [f for f in findings if f['severity'] == 'LOW']

    print(f"[SCAN] Regex: {len(regex_findings)} | High: {len(high)} Medium: {len(medium)} Low: {len(low)}")

    # Preliminary score — if high > 0 we give it 85 to trigger exploit generation on fallback
    if len(high) > 0:
        prelim = min(85 + len(high)*5, 100)
    else:
        prelim = min(len(medium) * 15 + len(low) * 5, 60)

    return {
        'findings': findings,
        'high': high,
        'medium': medium,
        'low': low,
        'preliminary_score': prelim,
        'slither_used': len(slither_findings) > 0,
        'prompt_context': _format_for_prompt(findings, slither_findings),
    }


def _format_for_prompt(findings: List[Dict], slither_findings: List[Dict]) -> str:
    if not findings:
        return "Static analysis (regex): no suspicious patterns detected."

    source = "Slither + regex" if slither_findings else "regex"
    lines = [f"Static pre-analysis ({source}) — {len(findings)} finding(s):"]
    for f in findings:
        lines.append(f"  [{f['severity']}] {f['name']}: {f['description']}")
    lines.append(
        "\nUse these as starting points. Focus your analysis on confirming or disproving each "
        "finding, and look for additional unknown attack vectors not listed above."
    )
    return "\n".join(lines)
