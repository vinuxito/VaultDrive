"""Offline structure/declared-evidence checker. No source access or execution authority.

Requires Python 3.10+ and an already installed jsonschema supporting Draft 2020-12.
Reads only an explicit JSON input and the packaged schema/rubric. No network or app calls.
"""
from __future__ import annotations

import argparse
import json
import math
import stat
import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
MAX_BYTES = 2 * 1024 * 1024

class CheckError(ValueError):
    """Invalid local input, unavailable dependency, or incompatible bundle."""

def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise CheckError('Duplicate JSON object key detected.')
        result[key] = value
    return result

def _bad_constant(_: str) -> None:
    raise CheckError('Non-finite JSON constants are not allowed.')

def _finite_float(text: str) -> float:
    value = float(text)
    if not math.isfinite(value):
        raise CheckError('Numeric value is outside finite range.')
    return value

def load_json(path: Path) -> Any:
    """Read a bounded explicit regular file; do not resolve or fetch evidence locators."""
    try:
        info = path.lstat()
        if not stat.S_ISREG(info.st_mode):
            raise CheckError('Input must be a regular file, not a directory or symlink.')
        if info.st_size > MAX_BYTES:
            raise CheckError('Input exceeds the 2 MiB local checker limit.')
        with path.open('rb') as stream:
            raw = stream.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise CheckError('Input exceeds the 2 MiB local checker limit.')
        return json.loads(raw.decode('utf-8'), object_pairs_hook=_unique_object,
                          parse_constant=_bad_constant, parse_float=_finite_float)
    except (OSError, UnicodeError, json.JSONDecodeError, RecursionError) as exc:
        raise CheckError(f'Cannot read valid UTF-8 JSON ({type(exc).__name__}).') from exc

def _schema(kind: str) -> dict[str, Any]:
    if kind not in {'assessment', 'policy'}:
        raise CheckError('Kind must be assessment or policy.')
    schema = load_json(ROOT / 'schemas' / f'{kind}.schema.json')
    def walk(node: Any) -> None:
        if isinstance(node, dict):
            if '$ref' in node and not str(node['$ref']).startswith('#/'):
                raise CheckError('Bundled schema has a non-local reference; refusing resolution.')
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)
    walk(schema)
    return schema

def _date(value: str) -> datetime:
    return datetime.fromisoformat(value.replace('Z', '+00:00'))

def _blank_strings(node: Any, path: str = '$') -> list[str]:
    errors: list[str] = []
    if isinstance(node, str) and not node.strip():
        errors.append(f'{path}: whitespace-only string is not meaningful.')
    elif isinstance(node, dict):
        for key, value in node.items():
            errors += _blank_strings(value, f'{path}.{key}')
    elif isinstance(node, list):
        for index, value in enumerate(node):
            errors += _blank_strings(value, f'{path}[{index}]')
    return errors

def check(data: Any, kind: str = 'assessment') -> tuple[list[str], dict[str, Any]]:
    """Check claims for consistency, never verify their external truth."""
    try:
        from jsonschema import Draft202012Validator, FormatChecker
    except ImportError as exc:
        raise CheckError('Optional checker requires an already installed jsonschema. Nothing was installed.') from exc
    schema = _schema(kind)
    Draft202012Validator.check_schema(schema)
    format_checker = FormatChecker()
    @format_checker.checks('date-time', raises=(ValueError, TypeError))
    def _is_rfc3339_datetime(instance: Any) -> bool:
        if not isinstance(instance, str) or 'T' not in instance.upper():
            return False
        parsed = _date(instance)
        return parsed.tzinfo is not None
    errors: list[str] = []
    for problem in Draft202012Validator(schema, format_checker=format_checker).iter_errors(data):
        # Avoid echoing sensitive field values from input in public logs.
        pointer = '$' + ''.join(f'[{p}]' if isinstance(p, int) else f'.{p}' for p in problem.absolute_path)
        errors.append(f'{pointer}: schema constraint failed ({problem.validator}).')
    summary: dict[str, Any] = {
        'contract_valid': False,
        'check_kind': kind,
        'scope': 'Structure and declared-evidence consistency only; sources were NOT inspected.',
        'execution_authorized': False,
    }
    if errors:
        return errors, summary
    errors += _blank_strings(data)
    if kind == 'policy':
        summary['contract_valid'] = not errors
        summary['runtime_enforcement_verified'] = False
        return errors, summary

    rubric = load_json(ROOT / 'assets' / 'rubric.json')
    if data['rubric_version'] != rubric['rubric_version']:
        errors.append('Rubric version mismatch.')
    start, end = _date(data['scope']['window_start']), _date(data['scope']['window_end'])
    if start > end:
        errors.append('Scope observation window ends before it starts.')
    evidence = {record['id']: record for record in data['evidence']}
    if len(evidence) != len(data['evidence']):
        errors.append('Evidence IDs must be unique.')
    for record in data['evidence']:
        if _date(record['observed_at']) > end:
            errors.append(f'Evidence {record["id"]} was observed after the assessment window ended.')

    def refs(ids: list[str], where: str, require_support: bool = False) -> None:
        for eid in ids:
            if eid not in evidence:
                errors.append(f'{where}: unknown evidence ID {eid}.')
        eligible = [evidence[eid] for eid in ids if eid in evidence
                    and evidence[eid]['inspected']
                    and evidence[eid]['currentness'] == 'current'
                    and evidence[eid]['kind'] != 'claim']
        if require_support and not eligible:
            errors.append(f'{where}: pass requires current inspected non-claim evidence.')
        if require_support and data['assurance'] == 'observed':
            if any(evidence[eid]['synthetic'] for eid in ids if eid in evidence):
                errors.append(f'{where}: observed assessment cannot use synthetic evidence to support a pass.')
        if data['assurance'] == 'synthetic_example':
            if any(not evidence[eid]['synthetic'] for eid in ids if eid in evidence):
                errors.append(f'{where}: a synthetic exercise must not relabel referenced evidence as operational.')

    for gate_id, gate in data['gates'].items():
        refs(gate['evidence_ids'], gate_id, gate['status'] == 'pass')
    for consumer in data['consumers']:
        refs(consumer['evidence_ids'], f'consumer {consumer["id"]}', data['reported_rung'] == 'r4')
    ids = [c['id'] for c in data['consumers']]
    if len(ids) != len(set(ids)):
        errors.append('Consumer IDs must be unique; duplicated labels are not reuse.')
    blocker_ids = [b['id'] for b in data['blockers']]
    if len(blocker_ids) != len(set(blocker_ids)):
        errors.append('Blocker IDs must be unique.')
    for blocker in data['blockers']:
        refs(blocker['evidence_ids'], f'blocker {blocker["id"]}')
    if data['comparison'] is not None:
        refs(data['comparison']['evidence_ids'], 'comparison', data['reported_rung'] == 'r4')

    design = data['mode'] == 'design_only' or data['assurance'] == 'design_only'
    if design:
        if data['mode'] != 'design_only' or data['assurance'] != 'design_only':
            errors.append('Design mode and design assurance must agree.')
        if any(g['status'] == 'pass' for g in data['gates'].values()):
            errors.append('A design-only assessment cannot declare demonstrated gate passes.')

    supported = 'undetermined'
    for rung in ['r1','r2','r3','r4']:
        needed = [g['id'] for g in rubric['gates'] if g['rung'] == rung]
        if not all(data['gates'][g]['status'] == 'pass' for g in needed):
            break
        supported = rung
    if design:
        supported = 'undetermined'
    if data['reported_rung'] != supported:
        errors.append(f'Reported rung differs from cumulative declared gate result ({supported}).')

    if data['reported_rung'] == 'r4':
        if len(data['consumers']) < 2:
            errors.append('Rung 4 needs at least two declared distinct consuming contexts.')
        c = data['comparison']
        if c is None:
            errors.append('Rung 4 needs a comparable-work and lifecycle cost record.')
        else:
            for field in ['workload_comparable','mandatory_review_preserved','neighbor_burden_checked',
                          'guardrails_preserved','lifecycle_costs_accepted','benefit_demonstrated']:
                if not c[field]:
                    errors.append(f'Rung 4 comparison does not support {field}.')
            # Cross multiplication avoids division and zero-denominator issues.
            after = Decimal(str(c['routine_steering_minutes_after'])) * c['accepted_outcomes_before']
            before = Decimal(str(c['routine_steering_minutes_before'])) * c['accepted_outcomes_after']
            if after > before:
                errors.append('Rung 4 contradicts increased routine central steering per accepted outcome.')

    open_blockers = [b for b in data['blockers'] if b['severity']=='blocking' and b['status']=='open']
    if open_blockers and data['deployment_decision']=='ready_for_owner_review':
        errors.append('Open blocking risks forbid a ready-for-owner-review recommendation.')
    if data['deployment_decision']=='ready_for_owner_review' and data['assurance']!='observed':
        errors.append('Design or synthetic evidence cannot justify operational readiness review.')
    if data['deployment_decision']=='ready_for_owner_review' and supported=='undetermined':
        errors.append('Undetermined capability cannot justify a readiness recommendation.')
    if data['deployment_decision']=='containment_required' and not open_blockers:
        errors.append('Containment-required recommendation needs an identified open blocking risk.')
    if data['next_action']['kind'] in {'propose_change','containment_review'} and not data['next_action']['requires_separate_authorization']:
        errors.append('Change or containment action must retain separate execution authorization.')
    summary.update({'contract_valid':not errors,'assurance':data['assurance'],
                    'recorded_evidence_rung':supported,'deployment_decision':data['deployment_decision'],
                    'source_authenticity_verified':False,'runtime_permissions_verified':False})
    return errors, summary

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('kind', choices=['assessment','policy'])
    parser.add_argument('input', type=Path, help='One explicit local JSON file; evidence URLs are never followed.')
    args = parser.parse_args(argv)
    try:
        errors, result = check(load_json(args.input), args.kind)
    except (CheckError, ValueError, RecursionError) as exc:
        print(f'Checker error: {exc}', file=sys.stderr)
        return 2
    result['errors'] = errors
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0

if __name__ == '__main__':
    raise SystemExit(main())
