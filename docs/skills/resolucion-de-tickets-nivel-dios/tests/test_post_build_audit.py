#!/usr/bin/env python3
"""Exercise the audit gate with synthetic evidence in temporary directories."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
skill = Path(__file__).resolve().parents[1]
script = skill / 'scripts/check-post-build-audit.py'
spec = importlib.util.spec_from_file_location('audit_gate', script)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class AuditGateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='filemon audit QA ')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root/'app').mkdir()
        (self.root/'app/source.txt').write_text('synthetic current build\n')
        (self.root/'report.md').write_text('# Synthetic audit report\n')
        (self.root/'evidence.json').write_text('{"synthetic":true}\n')
        self.data = {'schema_version': 1,
                     'build': {'id': 'fixture-v1', 'environment': 'disposable skill fixture', 'report': 'report.md',
                               'files': [{'path': 'app/source.txt', 'sha256': hashlib.sha256((self.root/'app/source.txt').read_bytes()).hexdigest()}]},
                     'requirements': [{'id': 'R1', 'description': 'Saved result survives reload', 'check_ids': ['C1']}],
                     'checks': [{'id': 'C1', 'requirement_ids': ['R1'], 'status': 'PASS', 'build_id': 'fixture-v1',
                                 'environment': 'fixture', 'method': 'synthetic contract test',
                                 'command_or_steps': 'Create synthetic result; read it again',
                                 'expected': 'Same fixture result', 'actual': 'Same fixture result', 'evidence': ['evidence.json']}],
                     'findings': []}

    def evaluate(self):
        return gate.evaluate(self.data, self.root, 'fixture-v1')

    def reject(self):
        with self.assertRaises(ValueError):
            self.evaluate()

    def finding(self, status='FIXED'):
        self.data['findings'] = [{'id': 'F1', 'severity': 'HIGH', 'status': status,
                                 'requirement_ids': [] if status == 'OUT_OF_SCOPE' else ['R1'],
                                 'reproduction': 'Synthetic result lost on reload', 'expected': 'Persisted',
                                 'actual': 'Lost', 'cause': 'Fixture defect', 'fix': 'Restore fixture save',
                                 'verification_check_ids': ['C1'], 'reason': 'Explicitly outside this synthetic scope'}]

    def test_complete_audit_passes(self):
        result, code = self.evaluate()
        self.assertEqual((code, result['status'], result['requirements']), (0, 'PASS', 1))

    def test_fixed_bug_requires_passing_regression(self):
        self.finding()
        self.assertEqual(self.evaluate()[1], 0)
        self.data['checks'][0]['status'] = 'FAIL'
        self.reject()

    def test_fixed_bug_cannot_omit_rerun(self):
        self.finding(); self.data['findings'][0]['verification_check_ids'] = []
        self.reject()

    def test_open_bug_fails(self):
        self.finding('OPEN')
        self.assertEqual(self.evaluate()[1], 2)

    def test_deferred_fix_is_partial(self):
        self.finding('DEFERRED')
        self.assertEqual(self.evaluate()[1], 3)

    def test_outside_scope_is_visible(self):
        self.finding('OUT_OF_SCOPE')
        result, code = self.evaluate()
        self.assertEqual((code, result['out_of_scope']), (0, ['F1']))
        self.data['findings'][0]['reason'] = ''
        self.reject()

    def test_in_scope_bug_cannot_be_waived_as_outside_scope(self):
        self.finding('OUT_OF_SCOPE')
        self.data['findings'][0]['requirement_ids'] = ['R1']
        self.reject()

    def test_fixed_bug_cannot_use_unrelated_regression(self):
        self.finding()
        self.data['requirements'].append({'id': 'R2', 'description': 'Different criterion', 'check_ids': ['C2']})
        extra = copy.deepcopy(self.data['checks'][0]); extra.update(id='C2', requirement_ids=['R2'])
        self.data['checks'].append(extra)
        self.data['findings'][0]['verification_check_ids'] = ['C2']
        self.reject()

    def test_fail_check_fails(self):
        self.data['checks'][0]['status'] = 'FAIL'
        self.assertEqual(self.evaluate()[1], 2)

    def test_skipped_blocked_partial_never_verified(self):
        for status in ('SKIPPED', 'BLOCKED', 'PARTIAL'):
            with self.subTest(status=status):
                self.data['checks'][0]['status'] = status
                self.assertEqual(self.evaluate()[1], 3)

    def test_uncovered_feature_rejected(self):
        self.data['requirements'].append({'id': 'R2', 'description': 'Cancel returns safely', 'check_ids': []})
        self.reject()

    def test_unknown_check_rejected(self):
        self.data['requirements'][0]['check_ids'] = ['unknown']
        self.reject()

    def test_mapping_is_bidirectional(self):
        self.data['checks'][0]['requirement_ids'] = ['unknown']
        self.reject()

    def test_empty_inventory_rejected(self):
        self.data['requirements'] = []; self.data['checks'] = []
        self.reject()

    def test_missing_evidence_rejected(self):
        self.data['checks'][0]['evidence'] = ['missing.json']
        self.reject()

    def test_empty_evidence_rejected(self):
        (self.root/'evidence.json').write_text('')
        self.reject()

    def test_outside_evidence_rejected(self):
        self.data['checks'][0]['evidence'] = ['../outside.txt']
        self.reject()

    def test_symlink_escape_rejected(self):
        with tempfile.NamedTemporaryFile() as outside:
            (self.root/'escape').symlink_to(outside.name)
            self.data['checks'][0]['evidence'] = ['escape']
            self.reject()

    def test_changed_build_invalidates_prior_checks(self):
        (self.root/'app/source.txt').write_text('synthetic unverified fix')
        self.reject()

    def test_wrong_build_id_rejected(self):
        self.data['build']['id'] = 'prior-build'
        self.reject()

    def test_stale_check_rejected(self):
        self.data['checks'][0]['build_id'] = 'prior-build'
        self.reject()

    def test_duplicate_ids_rejected(self):
        self.data['checks'].append(copy.deepcopy(self.data['checks'][0]))
        self.reject()

    def test_placeholder_output_rejected(self):
        self.data['checks'][0]['actual'] = ''
        self.reject()

    def test_cli_exit_contract_and_no_mutation(self):
        manifest = self.root/'audit.json'
        for status, expected in [('PASS', 0), ('FAIL', 2), ('BLOCKED', 3)]:
            self.data['checks'][0]['status'] = status
            manifest.write_text(json.dumps(self.data))
            before = {p.name: p.read_bytes() for p in self.root.iterdir() if p.is_file()}
            result = subprocess.run([sys.executable, str(script), str(manifest), '--project', str(self.root), '--build-id', 'fixture-v1'], capture_output=True)
            self.assertEqual(result.returncode, expected, result.stderr.decode())
            self.assertEqual(before, {p.name: p.read_bytes() for p in self.root.iterdir() if p.is_file()})

    def test_duplicate_json_keys_rejected_by_cli(self):
        manifest = self.root/'audit.json'
        manifest.write_text('{"schema_version":1,"schema_version":1}')
        result = subprocess.run([sys.executable, str(script), str(manifest), '--project', str(self.root), '--build-id', 'fixture-v1'], capture_output=True)
        self.assertEqual(result.returncode, 2)
        self.assertIn('Duplicate JSON key', result.stdout.decode())


if __name__ == '__main__':
    unittest.main(verbosity=2)
