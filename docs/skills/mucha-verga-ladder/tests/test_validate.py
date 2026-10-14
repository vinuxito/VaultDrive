"""Deterministic local contract tests. Synthetic inputs only; no application tests."""
from __future__ import annotations
import copy
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('mvl_check',ROOT/'tools/validate.py')
v=importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)
R4=json.loads((ROOT/'examples/04-shared-reader-r4.json').read_text(encoding='utf-8'))
POLICY=json.loads((ROOT/'templates/policy.example.json').read_text(encoding='utf-8'))

def fresh():return copy.deepcopy(R4)

class ContractTests(unittest.TestCase):
    def assert_bad(self,a,kind='assessment'):
        errors,summary=v.check(a,kind)
        self.assertTrue(errors)
        self.assertFalse(summary['contract_valid'])
        self.assertFalse(summary['execution_authorized'])
    def test_policy_default_valid(self):
        errors,summary=v.check(POLICY,'policy');self.assertEqual(errors,[])
        self.assertFalse(summary['runtime_enforcement_verified'])
    def test_blank_is_design_not_result(self):
        a=v.load_json(ROOT/'templates/assessment.blank.json')
        e,s=v.check(a);self.assertFalse(e);self.assertEqual(s['recorded_evidence_rung'],'undetermined')
    def test_execution_never_enabled(self):
        a=fresh();a['assessment_authorizes_execution']=True;self.assert_bad(a)
    def test_unknown_root_property(self):
        a=fresh();a['secret_override']=True;self.assert_bad(a)
    def test_duplicate_evidence_id(self):
        a=fresh();a['evidence'].append(copy.deepcopy(a['evidence'][0]));self.assert_bad(a)
    def test_duplicate_consumer_id(self):
        a=fresh();a['consumers'][1]['id']=a['consumers'][0]['id'];self.assert_bad(a)
    def test_one_consumer_not_system_reuse(self):
        a=fresh();a['consumers']=a['consumers'][:1];self.assert_bad(a)
    def test_no_comparison_no_fourth_rung(self):
        a=fresh();a['comparison']=None;self.assert_bad(a)
    def test_steering_increase_blocks_fourth_rung(self):
        a=fresh();a['comparison']['routine_steering_minutes_after']=81;self.assert_bad(a)
    def test_normalization_not_absolute_steering(self):
        a=fresh();a['comparison']['accepted_outcomes_after']=80
        a['comparison']['routine_steering_minutes_after']=160
        e,s=v.check(a);self.assertFalse(e);self.assertEqual(s['recorded_evidence_rung'],'r4')
    def test_zero_before_with_positive_after(self):
        a=fresh();a['comparison']['routine_steering_minutes_before']=0;self.assert_bad(a)
    def test_zero_denominator_invalid(self):
        a=fresh();a['comparison']['accepted_outcomes_before']=0;self.assert_bad(a)
    def test_negative_cost_invalid(self):
        a=fresh();a['comparison']['recovery_minutes_after']=-1;self.assert_bad(a)
    def test_boolean_is_not_count(self):
        a=fresh();a['comparison']['accepted_outcomes_after']=True;self.assert_bad(a)
    def test_observed_cannot_relabel_synthetic(self):
        a=fresh();a['assurance']='observed';self.assert_bad(a)
    def test_design_no_pass(self):
        a=fresh();a['mode']='design_only';a['assurance']='design_only';a['reported_rung']='undetermined';self.assert_bad(a)
    def test_design_mode_assurance_agree(self):
        a=v.load_json(ROOT/'examples/06-design-not-demonstration.json');a['mode']='observe_only';self.assert_bad(a)
    def test_invalid_time(self):
        a=fresh();a['scope']['window_end']='yesterday';self.assert_bad(a)
    def test_naive_time_invalid(self):
        a=fresh();a['scope']['window_end']='2026-10-04T00:00:00';self.assert_bad(a)
    def test_reversed_time_window(self):
        a=fresh();a['scope']['window_start']='2026-10-05T00:00:00Z';self.assert_bad(a)
    def test_evidence_after_window(self):
        a=fresh();a['evidence'][0]['observed_at']='2026-10-05T00:00:00Z';self.assert_bad(a)
    def test_whitespace_scope_invalid(self):
        a=fresh();a['scope']['owner']='  ';self.assert_bad(a)
    def test_claim_alone_not_pass(self):
        a=fresh();a['evidence'][0]['kind']='claim';self.assert_bad(a)
    def test_unknown_evidence_reference(self):
        a=fresh();a['gates']['mission_and_scope']['evidence_ids']=['NEVER'];self.assert_bad(a)
    def test_uninspected_source_not_pass(self):
        a=fresh();a['evidence'][0]['inspected']=False;self.assert_bad(a)
    def test_synthetic_not_ready(self):
        a=fresh();a['deployment_decision']='ready_for_owner_review';self.assert_bad(a)
    def test_blocker_forbids_ready_review(self):
        a=fresh();a['assurance']='observed'
        for item in a['evidence']:item['synthetic']=False
        a['deployment_decision']='ready_for_owner_review'
        a['blockers']=[{'id':'B1','severity':'blocking','status':'open','description':'Unresolved risk.','evidence_ids':['E01']}]
        self.assert_bad(a)
    def test_valid_record_does_not_verify_real_evidence(self):
        a=fresh();a['assurance']='observed'
        for item in a['evidence']:item['synthetic']=False
        a['deployment_decision']='ready_for_owner_review'
        e,s=v.check(a);self.assertFalse(e)
        self.assertFalse(s['source_authenticity_verified']);self.assertFalse(s['runtime_permissions_verified'])
    def test_hold_is_valid_even_with_capability(self):
        a=fresh();a['deployment_decision']='hold'
        e,s=v.check(a);self.assertFalse(e);self.assertEqual(s['deployment_decision'],'hold')
    def test_containment_needs_risk(self):
        a=fresh();a['deployment_decision']='containment_required';self.assert_bad(a)
    def test_change_needs_authority(self):
        a=fresh();a['next_action']['kind']='propose_change';self.assert_bad(a)
    def test_same_rung_is_not_permission(self):
        a=fresh();a['next_action']['kind']='propose_change';a['next_action']['requires_separate_authorization']=True
        e,s=v.check(a);self.assertFalse(e);self.assertFalse(s['execution_authorized'])
    def test_duplicate_blocker_ids(self):
        a=fresh();b={'id':'B1','severity':'advisory','status':'open','description':'Review.','evidence_ids':[]}
        a['blockers']=[b,copy.deepcopy(b)];self.assert_bad(a)
    def test_unreachable_locator_not_fetched(self):
        a=fresh();a['evidence'][0]['locator']='https://invalid.example.test/never-fetch-this'
        e,s=v.check(a);self.assertFalse(e);self.assertFalse(s['source_authenticity_verified'])
    def test_all_schemas_valid(self):
        from jsonschema import Draft202012Validator
        for path in (ROOT/'schemas').glob('*.json'):
            Draft202012Validator.check_schema(v.load_json(path))
    def test_policy_execution_forbidden(self):
        a=copy.deepcopy(POLICY);a['execution_enabled']=True;self.assert_bad(a,'policy')
    def test_policy_workers_default_zero(self):
        a=copy.deepcopy(POLICY);a['limits']['max_new_workers']=1;self.assert_bad(a,'policy')
    def test_policy_external_calls_default_zero(self):
        a=copy.deepcopy(POLICY);a['limits']['max_external_calls']=1;self.assert_bad(a,'policy')
    def test_policy_empty_budget_invalid(self):
        a=copy.deepcopy(POLICY);a['limits']['max_elapsed_seconds']=0;self.assert_bad(a,'policy')
    def test_duplicate_json_keys_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'input.json';p.write_text('{"a": 1, "a": 2}')
            with self.assertRaises(v.CheckError):v.load_json(p)
    def test_nonfinite_json_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            for text in ['{"x":NaN}','{"x":Infinity}','{"x":-Infinity}','{"x":1e9999}']:
                p=Path(d)/'input.json';p.write_text(text)
                with self.assertRaises(v.CheckError):v.load_json(p)
    def test_invalid_json_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'input.json';p.write_text('{')
            with self.assertRaises(v.CheckError):v.load_json(p)
    def test_invalid_utf8_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'input.json';p.write_bytes(b'\xff')
            with self.assertRaises(v.CheckError):v.load_json(p)
    def test_size_limit(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'input.json';p.write_bytes(b' '*(v.MAX_BYTES+1))
            with self.assertRaises(v.CheckError):v.load_json(p)
    def test_directory_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(v.CheckError):v.load_json(Path(d))
    def test_input_symlink_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'input.json';p.write_text('{}');q=Path(d)/'link.json';q.symlink_to(p)
            with self.assertRaises(v.CheckError):v.load_json(q)
    def test_cli_valid(self):
        p=subprocess.run([sys.executable,'-B',str(ROOT/'tools/validate.py'),'assessment',str(ROOT/'examples/04-shared-reader-r4.json')],capture_output=True,text=True,timeout=10)
        self.assertEqual(p.returncode,0,p.stderr)
        self.assertFalse(json.loads(p.stdout)['execution_authorized'])
    def test_cli_missing_file(self):
        p=subprocess.run([sys.executable,'-B',str(ROOT/'tools/validate.py'),'assessment',str(ROOT/'NO_SUCH_FILE.json')],capture_output=True,text=True,timeout=10)
        self.assertEqual(p.returncode,2);self.assertIn('Checker error',p.stderr)
    def test_cli_invalid_assessment(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'bad.json';path.write_text('{}')
            p=subprocess.run([sys.executable,'-B',str(ROOT/'tools/validate.py'),'assessment',str(path)],capture_output=True,text=True,timeout=10)
            self.assertEqual(p.returncode,1);self.assertFalse(json.loads(p.stdout)['contract_valid'])
    def test_cli_does_not_mutate_input(self):
        p=ROOT/'examples/01-local-action-r1.json';before=p.read_bytes()
        subprocess.run([sys.executable,'-B',str(ROOT/'tools/validate.py'),'assessment',str(p)],capture_output=True,timeout=10,check=True)
        self.assertEqual(p.read_bytes(),before)

# Each generated case is a separately counted test, not an invisible assertion loop.
for path in sorted((ROOT/'examples').glob('*.json')):
    def sample_test(self,p=path):
        e,s=v.check(v.load_json(p));self.assertEqual(e,[],str(p));self.assertTrue(s['contract_valid'])
    setattr(ContractTests,'test_example_'+path.stem.replace('-','_'),sample_test)

for gate in R4['gates']:
    def missing_support(self,g=gate):
        a=fresh();a['gates'][g]['evidence_ids']=[];self.assert_bad(a)
    def unknown_gate(self,g=gate):
        a=fresh();a['gates'][g]['status']='unknown';self.assert_bad(a)
    def stale_support(self,g=gate):
        a=fresh();eid=a['gates'][g]['evidence_ids'][0]
        next(e for e in a['evidence'] if e['id']==eid)['currentness']='stale';self.assert_bad(a)
    setattr(ContractTests,'test_missing_support_'+gate,missing_support)
    setattr(ContractTests,'test_unknown_breaks_r4_'+gate,unknown_gate)
    setattr(ContractTests,'test_stale_support_'+gate,stale_support)

for field in ['workload_comparable','mandatory_review_preserved','neighbor_burden_checked','guardrails_preserved','lifecycle_costs_accepted','benefit_demonstrated']:
    def comparison_false(self,f=field):
        a=fresh();a['comparison'][f]=False;self.assert_bad(a)
    setattr(ContractTests,'test_r4_requires_'+field,comparison_false)

if __name__=='__main__':unittest.main()
