#!/usr/bin/env python3
"""Build static locale modules from English source, legacy hi/ta, and gap JSON."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "frontend/agent-portal/src/i18n"
OLD_COPY = ROOT / ".git"  # fallback handled below
OLD_COPY_PATH = Path("/tmp/old-copy.ts")


def extract_const_object(src: str, name: str) -> dict:
    marker = f"const {name}: Copy =" if name != "en" else "const en ="
    start = src.index(marker)
    brace = src.index("{", start)
    depth = 0
    for index in range(brace, len(src)):
        char = src[index]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                end = index + 1
                break
    js = "module.exports = " + src[brace:end].replace("…", "...")
    temp = Path("/tmp/batwa-locale-object.js")
    temp.write_text(js, encoding="utf-8")
    payload = subprocess.check_output(
        ["node", "-e", "console.log(JSON.stringify(require('/tmp/batwa-locale-object.js')))"],
        text=True,
    )
    return json.loads(payload)


def merge_by_path(current: dict, legacy: dict) -> dict:
    if isinstance(current, dict):
        merged = {}
        for key, value in current.items():
            child = legacy.get(key) if isinstance(legacy, dict) else None
            merged[key] = merge_by_path(value, child if isinstance(child, (dict, str)) else {})
        return merged
    if isinstance(legacy, str):
        return legacy
    return current


def apply_gaps(tree: dict, gaps: dict, prefix: str = "") -> dict:
    if isinstance(tree, dict):
        return {
            key: apply_gaps(value, gaps, f"{prefix}.{key}" if prefix else key)
            for key, value in tree.items()
        }
    return gaps.get(prefix, tree)


def to_ts(value, indent: int = 0) -> str:
    pad = "  " * indent
    if isinstance(value, dict):
        lines = ["{"]
        for key, child in value.items():
            lines.append(f"{pad}  {key}: {to_ts(child, indent + 1)},")
        lines.append(f"{pad}}}")
        return "\n".join(lines)
    escaped = (
        str(value)
        .replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\n", "\\n")
    )
    return f"'{escaped}'"


def write_locale(name: str, tree: dict) -> None:
    body = to_ts(tree, indent=1)
    path = I18N / "locales" / f"{name}.ts"
    path.parent.mkdir(parents=True, exist_ok=True)
    if name == "en":
        path.write_text(
            "\n".join(
                [
                    "export const en = " + body,
                    "export type Copy = typeof en",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        return
    path.write_text(
        "\n".join(
            [
                "import type { Copy } from './en'",
                "",
                f"export const {name}: Copy = {body}",
                "",
            ]
        ),
        encoding="utf-8",
    )


def main() -> None:
    english = extract_const_object((I18N / "locales/en.ts").read_text(encoding="utf-8"), "en")
    old_src = OLD_COPY_PATH.read_text(encoding="utf-8")
    legacy_hi = extract_const_object(old_src, "hi")
    legacy_ta = extract_const_object(old_src, "ta")
    gaps_hi = json.loads((I18N / "locale-gaps.hi.json").read_text(encoding="utf-8"))
    gaps_ta = json.loads((I18N / "locale-gaps.ta.json").read_text(encoding="utf-8"))
    full_mr = json.loads((I18N / "locale-full.mr.json").read_text(encoding="utf-8"))

    hindi = apply_gaps(merge_by_path(english, legacy_hi), gaps_hi)
    tamil = apply_gaps(merge_by_path(english, legacy_ta), gaps_ta)
    marathi = apply_gaps(english, full_mr)

    write_locale("hi", hindi)
    write_locale("ta", tamil)
    write_locale("mr", marathi)
    print("Wrote locales/hi.ts, ta.ts, mr.ts")


if __name__ == "__main__":
    main()
