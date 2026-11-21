#!/usr/bin/env python3
"""Build toys.js, cards.js and games.js from the editable CSVs.

    python3 scripts/build_toys_cards.py

Reads  toys-inventory.csv  -> writes toys.js  (const TOYS = [...])
       cards-inventory.csv -> writes cards.js (const CARDS = [...])
       games-inventory.csv -> writes games.js (const GAMES = [...])

Rows with "status" set to sold / hold / draft are left off the site.
Blank rows are skipped. Every row needs a unique sku.
"""
import csv, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HIDDEN_STATUS = {"sold", "hold", "draft", "hidden"}

JOBS = [
    ("toys-inventory.csv", "toys.js", "TOYS", "TOY"),
    ("cards-inventory.csv", "cards.js", "CARDS", "CARD"),
    ("games-inventory.csv", "games.js", "GAMES", "GAME"),
]


def build(csv_name, js_name, var, prefix):
    src = ROOT / csv_name
    rows, seen = [], set()
    with src.open(newline="", encoding="utf-8-sig") as f:
        for n, row in enumerate(csv.DictReader(f), start=2):
            row = {k.strip(): (v or "").strip() for k, v in row.items() if k}
            if not any(row.values()):
                continue
            if row.get("status", "").lower() in HIDDEN_STATUS:
                continue
            sku = row.get("sku", "")
            if not sku:
                sys.exit(f"{csv_name} line {n}: missing sku")
            if sku in seen:
                sys.exit(f"{csv_name} line {n}: duplicate sku {sku}")
            seen.add(sku)
            if row.get("price"):
                try:
                    row["price"] = f"{float(row['price'].replace('$', '')):.2f}"
                except ValueError:
                    sys.exit(f"{csv_name} line {n}: price '{row['price']}' is not a number")
            row.setdefault("quantity", "1")
            row["quantity"] = row["quantity"] or "1"
            row["id"] = f"{prefix}-{sku}"
            row.pop("status", None)
            rows.append(row)
    out = ROOT / js_name
    out.write_text(f"const {var} = {json.dumps(rows, ensure_ascii=False)};\n", encoding="utf-8")
    print(f"{js_name}: {len(rows)} item(s)")


if __name__ == "__main__":
    for job in JOBS:
        build(*job)
