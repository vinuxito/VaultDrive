#!/usr/bin/env python3
"""Generate deterministic synthetic rows, streaming to a NEW JSONL file; no app or DB access."""
import argparse
import json
import pathlib

CATEGORIES = ('Services', 'Supplies', 'Travel', 'Equipment')

def rows(count):
    for i in range(count):
        yield {'id': f'row-{i+1:08d}', 'name': ('Long international supplier name — Málaga / 東京 / São Paulo ' if i % 37 == 0 else 'Example supplier ') + str(i+1),
               'category': CATEGORIES[i % len(CATEGORIES)], 'amountMinor': ((i * 7919) % 250000) * (-1 if i % 29 == 0 else 1),
               'currency': 'USD', 'status': ('Review', 'Ready', 'Missing evidence')[i % 3],
               'description': '' if i % 43 == 0 else 'Synthetic item description ' + str(i+1), 'synthetic': True}

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--rows', type=int, default=10000)
    p.add_argument('--output', type=pathlib.Path, required=True)
    a = p.parse_args()
    if not 1 <= a.rows <= 1000000: p.error('--rows must be between 1 and 1000000')
    if not a.output.parent.is_dir(): p.error('Output parent must already exist')
    if a.output.is_symlink() or a.output.exists(): p.error('Existing output preserved; choose a new filename')
    try:
        with a.output.open('x', encoding='utf-8') as f:
            for row in rows(a.rows): f.write(json.dumps(row, ensure_ascii=False, separators=(',', ':')) + '\n')
    except OSError as e: p.exit(1, str(e) + '\n')
    print(json.dumps({'file':str(a.output), 'rows':a.rows, 'synthetic':True, 'format':'jsonl', 'businessWrites':False}))

if __name__ == '__main__': main()
