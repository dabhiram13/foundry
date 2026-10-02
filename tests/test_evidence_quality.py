"""Opt-in quality and commercial evidence exercised through public record/gate APIs."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts import workflow


class EvidenceQualityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'app.py').write_text('print("wrong")\n')
        (self.root / 'test.py').write_text('import subprocess,sys\np=subprocess.run([sys.executable,"app.py"],capture_output=True,text=True)\nassert p.stdout.strip() == "saved", p.stdout\nprint("one public CLI assertion passed")\n')
        self.command = [sys.executable, 'test.py']

    def payload(self, kind, identity, **fields):
        return dict(id=identity, kind=kind, title=identity,
                    source=dict(kind='owner', ref='local synthetic fixture', observed_at='2026-10-01'),
                    basis='observed', status='accepted', **fields)

    def receipt(self, label):
        revisions = {p: hashlib.sha256((self.root / p).read_bytes()).hexdigest() for p in ('app.py', 'test.py')}
        result = subprocess.run(self.command, cwd=self.root, capture_output=True)
        log = result.stdout + result.stderr
        (self.root / f'{label}.log').write_bytes(log)
        counts = dict(executed=1, passed=int(result.returncode == 0), failed=int(result.returncode != 0), skipped=0)
        identity = str(uuid.uuid4())
        report = json.dumps(dict(run_id=identity, tests=counts)).encode()
        (self.root / f'{label}-tests.json').write_bytes(report)
        value = dict(command=self.command, exit_code=result.returncode,
                     status='passed' if result.returncode == 0 else 'failed',
                     input_revisions=revisions, input_revisions_after=revisions,
                     log=f'{label}.log', log_sha256=hashlib.sha256(log).hexdigest(),
                     tests=counts, duration_seconds=0.1, check_run_id=identity,
                     test_report=f'{label}-tests.json', test_report_sha256=hashlib.sha256(report).hexdigest())
        (self.root / f'{label}.json').write_text(json.dumps(value))
        return value

    def prepare(self):
        red = self.receipt('red')
        (self.root / 'app.py').write_text('print("saved")\n')
        green = self.receipt('green')
        criterion = self.payload('criterion', 'save', stage='verify', required=True,
                                expected='CLI prints saved', method='command', command=self.command,
                                inputs=['app.py'], quality=dict(slice='Save one note', public_interface='CLI stdout',
                                oracle='spec literal saved', sensitivity='wrong stdout fails the same test', test_inputs=['test.py']))
        workflow.record(self.root, criterion)
        return red, green

    def observe(self):
        return workflow.record(self.root, self.payload('evidence', 'result', claim='CLI behavior checked',
             observed='one assertion executed', method='command', outcome='pass', artifact='green.json',
             criteria=['save'], quality={'red': 'red.json'}))

    def test_real_red_green_and_changed_source_invalidate(self):
        red, green = self.prepare()
        self.assertNotEqual(red['exit_code'], 0)
        self.assertEqual(green['exit_code'], 0)
        self.observe()
        self.assertEqual(workflow.gate(self.root)['status'], 'pass')
        (self.root / 'app.py').write_text('print("regressed")\n')
        self.assertEqual(workflow.gate(self.root)['status'], 'unverified')

    def test_missing_execution_nonfinite_and_reused_evidence_cannot_pass(self):
        _, green = self.prepare()
        for label, alter in (
            ('zero', lambda r: r.update(tests=dict(executed=0, passed=0, failed=0, skipped=0))),
            ('missing', lambda r: r.pop('tests')),
            ('nan', lambda r: r.update(duration_seconds=float('nan'))),
            ('overflow', lambda r: r.update(duration_seconds=10**1000)),
            ('bool', lambda r: r.update(tests=dict(executed=True, passed=True, failed=0, skipped=0))),
            ('skipped', lambda r: r.update(tests=dict(executed=1, passed=1, failed=0, skipped=1))),
        ):
            with self.subTest(label=label):
                candidate = copy.deepcopy(green); alter(candidate)
                (self.root / 'green.json').write_text(json.dumps(candidate))
                record = self.payload('evidence', label, claim='claimed success', observed='claims',
                     method='command', outcome='pass', artifact='green.json', criteria=['save'], quality={'red':'red.json'})
                workflow.record(self.root, record)
                self.assertEqual(workflow.gate(self.root)['status'], 'unverified')
        (self.root / 'green.json').write_text(json.dumps(green))
        (self.root / 'red.json').write_text(json.dumps(green))
        self.observe()
        self.assertEqual(workflow.gate(self.root)['status'], 'unverified')

    def test_changed_test_or_report_does_not_establish_sensitivity(self):
        red, _ = self.prepare()
        red['input_revisions'] = dict(red['input_revisions'], **{'test.py':'0' * 64})
        red['input_revisions_after'] = red['input_revisions']
        (self.root / 'red.json').write_text(json.dumps(red))
        self.observe()
        self.assertEqual(workflow.gate(self.root)['status'], 'unverified')

    def test_report_tampering_and_missing_red_remain_unverified(self):
        self.prepare()
        self.observe()
        (self.root / 'red-tests.json').write_text('{}')
        self.assertEqual(workflow.gate(self.root)['status'], 'unverified')
        (self.root / 'red.json').unlink()
        self.assertEqual(workflow.gate(self.root)['status'], 'unverified')

    def test_runtime_produced_red_green_receipts_integrate_with_gate(self):
        (self.root / 'test.py').write_text(
            'import subprocess,sys,os,json\n'
            'p=subprocess.run([sys.executable,"app.py"],capture_output=True,text=True)\n'
            'ok=p.stdout.strip()=="saved"\n'
            'counts=dict(executed=1,passed=int(ok),failed=int(not ok),skipped=0)\n'
            'with open(os.environ["FOUNDRY_TEST_REPORT"],"w") as f: json.dump(dict(run_id=os.environ["FOUNDRY_CHECK_ID"],tests=counts),f)\n'
            'print("observed",repr(p.stdout),"expected saved")\n'
            'sys.exit(0 if ok else 1)\n')
        def execute(label):
            check = dict(name='quote', command=self.command, inputs=['app.py','test.py'],
                         timeout=2, test_report=f'{label}-tests.json')
            receipt, interrupted = workflow.foundry.run_check(self.root,check,self.root / f'{label}.log')
            self.assertFalse(interrupted)
            (self.root / f'{label}.json').write_text(json.dumps(receipt))
            return receipt
        red=execute('red')
        self.assertEqual(red['status'],'failed')
        (self.root / 'app.py').write_text('print("saved")\n')
        green=execute('green')
        self.assertEqual(green['status'],'passed')
        workflow.record(self.root,self.payload('criterion','save',stage='verify',required=True,
            expected='CLI prints saved',method='command',command=self.command,inputs=['app.py'],
            quality=dict(slice='save a quote',public_interface='CLI stdout',oracle='saved literal',
                         sensitivity='same test fails on wrong output',test_inputs=['test.py'])))
        self.observe()
        self.assertEqual(workflow.gate(self.root)['status'],'pass')

    def test_recorded_failure_requires_explicit_resolution(self):
        self.prepare()
        workflow.record(self.root, self.payload('evidence','failure',claim='wrong CLI output',
            observed='assertion failed',method='command',outcome='fail',artifact='red.json',criteria=['save']))
        self.observe()
        self.assertEqual(workflow.gate(self.root)['status'],'fail')
        workflow.record(self.root, self.payload('evidence','repair',claim='fixed CLI',observed='same assertion passed',
            method='command',outcome='pass',artifact='green.json',criteria=['save'],
            quality={'red':'red.json'},supersedes='failure'))
        self.assertEqual(workflow.gate(self.root)['status'],'pass')

    def test_market_assumptions_provenance_and_review_date(self):
        market = dict(customer='solo shop owner', job='prepare a quote', alternative='spreadsheet',
                      differentiation='one reusable quote', channel='hypothesized trade forum',
                      activation_event='first saved quote', decision='test locally', next_review='2026-10-08', evidence_kind='synthetic')
        item = self.payload('evidence','market',claim='synthetic feedback only',market=market)
        with self.assertRaisesRegex(workflow.foundry.Error, 'inferred'):
            workflow.record(self.root,item)
        item['basis']='inferred'
        workflow.record(self.root,item)
        self.assertEqual(workflow.context(self.root)['records'][0]['market']['activation_event'],'first saved quote')
        item['id']='bad-date'; item['market']['next_review']='yesterday'
        with self.assertRaises(workflow.foundry.Error): workflow.record(self.root,item)
        item['id']='fake-customer'; item['market']['next_review']='2026-10-08'; item['market']['evidence_kind']='customer'
        with self.assertRaisesRegex(workflow.foundry.Error,'customer provenance'): workflow.record(self.root,item)
