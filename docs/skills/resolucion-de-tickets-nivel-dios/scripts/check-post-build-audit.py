#!/usr/bin/env python3
"""Check a declared post-build audit; does not run tests or mutate ticket state."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys


def nonempty(value, label):
    if not isinstance(value, str) or not value.strip():
        raise ValueError('Missing text: ' + label)
    return value


def unique_rows(value, label):
    if not isinstance(value, list):
        raise ValueError(label + ' must be a list.')
    rows = {}
    for row in value:
        if not isinstance(row, dict):
            raise ValueError(label + ' contains a non-object.')
        key = nonempty(row.get('id'), label + '.id')
        if key in rows:
            raise ValueError('Duplicate ID in ' + label + ': ' + key)
        rows[key] = row
    return rows


def identifiers(value, label):
    if not isinstance(value, list) or not value or len(value) != len(set(map(str, value))):
        raise ValueError('Missing/duplicate IDs: ' + label)
    return [nonempty(item, label) for item in value]


def artifact(root, value):
    relative = Path(nonempty(value, 'artifact path'))
    if relative.is_absolute() or '..' in relative.parts:
        raise ValueError('Artifact must be relative and inside the project: ' + str(relative))
    path = (root / relative).resolve()
    path.relative_to(root)
    if not path.is_file() or path.stat().st_size == 0:
        raise ValueError('Missing/empty artifact: ' + str(relative))
    return path


def evaluate(data, project, build_id):
    root = Path(project).resolve(strict=True)
    if not isinstance(data, dict) or data.get('schema_version') != 1:
        raise ValueError('Unsupported audit schema_version.')
    build = data.get('build', {})
    if not isinstance(build, dict) or nonempty(build.get('id'), 'build.id') != build_id:
        raise ValueError('Audit belongs to a different build.')
    nonempty(build.get('environment'), 'build.environment')
    artifact(root, build.get('report'))
    files = build.get('files')
    if not isinstance(files, list) or not files:
        raise ValueError('At least one affected build file/hash is required.')
    seen = set()
    for item in files:
        if not isinstance(item, dict):
            raise ValueError('Invalid build file.')
        path = artifact(root, item.get('path'))
        digest = item.get('sha256')
        if path in seen or not isinstance(digest, str) or not re.fullmatch(r'[0-9a-f]{64}', digest):
            raise ValueError('Invalid/duplicate build file hash.')
        seen.add(path)
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError('Build changed after verification: ' + item['path'])
    requirements = unique_rows(data.get('requirements'), 'requirements')
    checks = unique_rows(data.get('checks'), 'checks')
    findings = unique_rows(data.get('findings'), 'findings')
    if not requirements or not checks:
        raise ValueError('Audit must cover at least one requirement and check.')
    for key, check in checks.items():
        for field in ('method', 'command_or_steps', 'expected', 'actual', 'environment'):
            nonempty(check.get(field), key + '.' + field)
        if check.get('build_id') != build_id:
            raise ValueError('Stale check: ' + key)
        if check.get('status') not in ('PASS', 'FAIL', 'PARTIAL', 'SKIPPED', 'BLOCKED'):
            raise ValueError('Invalid check status: ' + key)
        for requirement_id in identifiers(check.get('requirement_ids'), key + '.requirement_ids'):
            if requirement_id not in requirements or key not in requirements[requirement_id].get('check_ids', []):
                raise ValueError('Unmapped check/requirement: ' + key)
        evidence = check.get('evidence')
        if not isinstance(evidence, list) or not evidence:
            raise ValueError('Missing evidence: ' + key)
        for path in evidence:
            artifact(root, path)
    for key, requirement in requirements.items():
        nonempty(requirement.get('description'), key + '.description')
        for check_id in identifiers(requirement.get('check_ids'), key + '.check_ids'):
            if check_id not in checks or key not in checks[check_id]['requirement_ids']:
                raise ValueError('Uncovered requirement: ' + key)
    for key, finding in findings.items():
        if finding.get('severity') not in ('BLOCKER', 'HIGH', 'MEDIUM', 'LOW'):
            raise ValueError('Invalid finding severity: ' + key)
        for field in ('reproduction', 'expected', 'actual', 'cause'):
            nonempty(finding.get(field), key + '.' + field)
        status = finding.get('status')
        linked = finding.get('requirement_ids', [])
        if status == 'OUT_OF_SCOPE':
            if linked != []:
                raise ValueError('An in-scope requirement cannot be waived as outside scope: ' + key)
        else:
            for requirement_id in identifiers(linked, key + '.requirement_ids'):
                if requirement_id not in requirements:
                    raise ValueError('Finding references an unknown requirement: ' + key)
        if status == 'FIXED':
            nonempty(finding.get('fix'), key + '.fix')
            for check_id in identifiers(finding.get('verification_check_ids'), key + '.verification_check_ids'):
                if (check_id not in checks or checks[check_id]['status'] != 'PASS'
                        or not set(linked).intersection(checks[check_id]['requirement_ids'])):
                    raise ValueError('Fix lacks passing final regression: ' + key)
            covered = {requirement_id for check_id in finding['verification_check_ids']
                       for requirement_id in checks[check_id]['requirement_ids']}
            if set(linked) - covered:
                raise ValueError('Fix lacks regression for every affected requirement: ' + key)
        elif status in ('OPEN', 'DEFERRED', 'OUT_OF_SCOPE'):
            nonempty(finding.get('reason'), key + '.reason')
        else:
            raise ValueError('Invalid finding status: ' + key)
    statuses = {row['status'] for row in checks.values()}
    finding_states = {row['status'] for row in findings.values()}
    code = 2 if 'FAIL' in statuses or 'OPEN' in finding_states else (
        3 if statuses - {'PASS'} or 'DEFERRED' in finding_states else 0)
    return {'status': {0: 'PASS', 2: 'FAIL', 3: 'PARTIAL'}[code],
            'requirements': len(requirements), 'checks': len(checks),
            'findings': len(findings), 'out_of_scope': [key for key, row in findings.items() if row['status'] == 'OUT_OF_SCOPE'],
            'scope': 'Declared audit integrity only; actual test execution requires its evidence.'}, code


def no_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate JSON key: ' + key)
        result[key] = value
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest')
    parser.add_argument('--project', required=True)
    parser.add_argument('--build-id', required=True)
    args = parser.parse_args()
    try:
        data = json.loads(Path(args.manifest).read_text(encoding='utf-8'), object_pairs_hook=no_duplicates)
        result, code = evaluate(data, args.project, nonempty(args.build_id, 'expected build ID'))
    except (ValueError, OSError, TypeError, KeyError) as error:
        result, code = {'status': 'FAIL', 'error': str(error)}, 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return code


if __name__ == '__main__':
    sys.exit(main())
