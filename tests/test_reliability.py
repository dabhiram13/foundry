"""Regression checks for observed input and crash boundaries."""
import io
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from contextlib import redirect_stdout
from unittest import mock

import test_runtime as runtime

foundry, git = runtime.foundry, runtime.git


class ReliabilityTests(unittest.TestCase):
    make_project = runtime.RuntimeTests.make_project
    make_source = runtime.RuntimeTests.make_source
    start = runtime.RuntimeTests.start

    def quiet(self, fn, *args):
        with redirect_stdout(io.StringIO()):
            return fn(*args)

    def test_ignored_environment_configuration_invalidates_completion(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_project(Path(tmp))
            (root / '.gitignore').write_text('.env\n')
            (root / '.env').write_text('MODE=reviewed')
            self.start(root)
            self.assertEqual(self.quiet(foundry.verify, root), 0)
            (root / '.env').write_text('MODE=changed')
            with self.assertRaisesRegex(foundry.Error, 'stale'):
                foundry.complete(root)

    def test_index_only_changes_invalidate_completion(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_project(Path(tmp))
            self.start(root)
            self.quiet(foundry.verify, root)
            original = (root / 'backend/config.ini').read_text()
            (root / 'backend/config.ini').write_text('different staged bytes')
            git(root, 'add', 'backend/config.ini')
            (root / 'backend/config.ini').write_text(original)
            with self.assertRaisesRegex(foundry.Error, 'stale'):
                foundry.complete(root)

    def test_declared_ignored_inputs_and_environment_are_hashed_without_values(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_project(Path(tmp), [{'name':'behavior','command':[sys.executable,'-c','print("ok")'], 'inputs':['local-settings.txt'], 'environment':['MARKETCRAFT_TEST_MODE']}])
            (root / '.gitignore').write_text('local-settings.txt\n')
            (root / 'local-settings.txt').write_text('reviewed')
            self.start(root)
            with mock.patch.dict(os.environ, {'MARKETCRAFT_TEST_MODE':'sensitive-example-value'}):
                self.quiet(foundry.verify, root)
                evidence = (root / foundry.active(root)[1]['verification']).read_text()
                self.assertNotIn('sensitive-example-value', evidence)
                (root / 'local-settings.txt').write_text('changed')
                with self.assertRaisesRegex(foundry.Error, 'stale'):
                    foundry.complete(root)
                self.quiet(foundry.verify, root)
            with self.assertRaisesRegex(foundry.Error, 'stale'):
                foundry.complete(root)

    def test_completion_recovers_after_record_before_state_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_project(Path(tmp))
            self.start(root)
            self.quiet(foundry.verify, root)
            original = foundry.atomic_json
            def crash(path, data):
                if data.get('status') == 'completed':
                    raise OSError('simulated loss before completed-state save')
                return original(path, data)
            with mock.patch.object(foundry, 'atomic_json', side_effect=crash):
                with self.assertRaises(OSError):
                    foundry.complete(root)
            self.assertEqual(self.quiet(foundry.complete, root), 0)
            self.assertEqual(self.quiet(foundry.complete, root), 0)
            self.assertIsNone(foundry.active(root)[1])
            self.assertEqual(len(list((root / 'docs/built').glob('*.md'))), 1)

    def test_completion_recovers_after_state_before_pointer_delete(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_project(Path(tmp))
            self.start(root)
            self.quiet(foundry.verify, root)
            original = Path.unlink
            def crash(path, *args, **kwargs):
                if path == root / '.foundry/state/active.json':
                    raise OSError('simulated pointer deletion loss')
                return original(path, *args, **kwargs)
            with mock.patch.object(Path, 'unlink', crash):
                with self.assertRaises(OSError):
                    foundry.complete(root)
            self.assertEqual(self.quiet(foundry.complete, root), 0)
            self.assertIsNone(foundry.active(root)[1])
            self.assertEqual(len(list((root / 'docs/built').glob('*.md'))), 1)

    def test_completion_recovers_before_record_and_preserves_conflicting_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_project(Path(tmp))
            self.start(root)
            self.quiet(foundry.verify, root)
            with mock.patch.object(foundry, 'atomic_text', side_effect=OSError('record write lost')):
                with self.assertRaises(OSError):
                    foundry.complete(root)
            state = foundry.active(root)[1]
            self.assertEqual(state['status'], 'completing')
            out = root / state['completion']['path']
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text('owner edit')
            with self.assertRaisesRegex(foundry.Error, 'changed'):
                foundry.complete(root)
            self.assertEqual(out.read_text(), 'owner edit')
            out.unlink()
            self.assertEqual(self.quiet(foundry.recover, root), 0)
            self.assertIsNone(foundry.active(root)[1])

    def test_abrupt_verification_loss_requires_explicit_truthful_recovery(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_project(Path(tmp))
            self.start(root)
            with mock.patch.object(foundry, 'run_check', side_effect=OSError('coordinator lost')):
                with self.assertRaises(OSError):
                    foundry.verify(root)
            state = foundry.active(root)[1]
            self.assertEqual(state['status'], 'verifying')
            with self.assertRaisesRegex(foundry.Error, 'recover'):
                foundry.resume_or_pause(root, False)
            self.quiet(foundry.recover, root)
            state = foundry.active(root)[1]
            self.assertEqual(state['status'], 'paused')
            evidence = foundry.read_json(root / state['verification'])
            self.assertFalse(evidence['passed'])
            self.assertEqual(evidence['status'], 'interrupted')
            with self.assertRaises(foundry.Error):
                foundry.complete(root)

    def test_check_receipt_pins_declared_input_revisions(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_project(Path(tmp), [{'name':'behavior','command':[sys.executable,'-c','print("ok")'], 'inputs':['backend']}])
            self.start(root)
            self.quiet(foundry.verify, root)
            evidence = foundry.read_json(root / foundry.active(root)[1]['verification'])
            receipt = evidence['checks'][0]
            self.assertEqual(receipt['input_revisions'], receipt['input_revisions_after'])
            self.assertEqual(receipt['input_revisions']['backend/config.ini'], foundry.digest((root / 'backend/config.ini').read_bytes()))

    def test_cold_python_import_does_not_invalidate_declared_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            check = {'name':'behavior', 'command':[sys.executable, '-c',
                     'import sys; sys.dont_write_bytecode = False; import backend.module'],
                     'inputs':['backend']}
            root = self.make_project(Path(tmp), [check])
            (root / '.gitignore').write_text('__pycache__/\n*.pyc\n*.pyo\n')
            source = root / 'backend/module.py'
            source.write_text('VALUE = 1\n')
            self.start(root)
            self.assertFalse((source.parent / '__pycache__').exists())
            self.assertEqual(self.quiet(foundry.verify, root), 0)
            caches = list(source.parent.glob('__pycache__/*.pyc'))
            self.assertTrue(caches)
            evidence = foundry.read_json(root / foundry.active(root)[1]['verification'])
            receipt = evidence['checks'][0]
            self.assertEqual(receipt['input_revisions'], receipt['input_revisions_after'])
            self.assertIn('backend/module.py', receipt['input_revisions'])
            self.assertFalse(any('__pycache__' in p for p in receipt['input_revisions']))
            before = foundry.snapshot(root)
            caches[0].write_bytes(b'changed incidental bytecode')
            self.assertEqual(foundry.snapshot(root), before)
            caches[0].unlink()
            self.assertEqual(foundry.snapshot(root), before)
            (source.parent / 'legacy.pyc').write_bytes(b'incidental legacy cache')
            (source.parent / 'legacy.pyo').write_bytes(b'incidental optimized cache')
            self.assertEqual(foundry.snapshot(root), before)
            self.assertEqual(foundry.declared_revisions(root, check), receipt['input_revisions'])
            source.write_text('VALUE = 2\n')
            with self.assertRaisesRegex(foundry.Error, 'stale'):
                foundry.complete(root)

    def test_explicit_bytecode_and_build_artifacts_remain_inputs(self):
        with tempfile.TemporaryDirectory() as tmp:
            check = {'name':'behavior', 'command':[sys.executable, '-c', 'pass'],
                     'inputs':['backend', 'backend/__pycache__/explicit.pyc']}
            root = self.make_project(Path(tmp), [check])
            artifact = root / 'backend/__pycache__/explicit.pyc'
            artifact.parent.mkdir()
            artifact.write_bytes(b'explicit artifact')
            build = root / 'backend/dist/bundle.js'
            build.parent.mkdir()
            build.write_text('reviewed build')
            self.start(root)
            self.assertEqual(self.quiet(foundry.verify, root), 0)
            revisions = foundry.declared_revisions(root, check)
            self.assertIn('backend/__pycache__/explicit.pyc', revisions)
            self.assertIn('backend/dist/bundle.js', revisions)
            artifact.write_bytes(b'changed artifact')
            with self.assertRaisesRegex(foundry.Error, 'stale'):
                foundry.complete(root)

    def test_declared_cache_symlinks_and_missing_inputs_are_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            check = {'name':'behavior', 'command':[sys.executable, '-c', 'pass'],
                     'inputs':['backend']}
            root = self.make_project(Path(tmp), [check])
            outside = Path(tmp) / 'outside'
            outside.mkdir()
            (outside / 'secret.pyc').write_bytes(b'outside')
            link = root / 'backend/__pycache__'
            link.symlink_to(outside, target_is_directory=True)
            for operation in (lambda: foundry.snapshot(root),
                              lambda: foundry.declared_revisions(root, check)):
                with self.assertRaises(foundry.Error):
                    operation()
            link.unlink()
            check['inputs'] = ['missing.pyc']
            with self.assertRaisesRegex(foundry.Error, 'missing'):
                foundry.declared_revisions(root, check)

    def test_source_edit_after_completion_crash_can_recover_and_reverify(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_project(Path(tmp))
            self.start(root)
            self.quiet(foundry.verify, root)
            with mock.patch.object(foundry, 'atomic_text', side_effect=OSError('record write lost')):
                with self.assertRaises(OSError):
                    foundry.complete(root)
            (root / 'backend/config.ini').write_text('new accepted change')
            self.assertEqual(self.quiet(foundry.recover, root), 0)
            self.assertEqual(foundry.active(root)[1]['status'], 'paused')
            self.assertEqual((root / 'backend/config.ini').read_text(), 'new accepted change')
            self.assertEqual(self.quiet(foundry.verify, root), 0)
            self.assertEqual(self.quiet(foundry.complete, root), 0)

    def test_declared_input_traversal_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_project(Path(tmp), [{'name':'behavior','command':[sys.executable,'-c','pass'], 'inputs':['../outside']}])
            self.start(root)
            with self.assertRaisesRegex(foundry.Error, 'escapes'):
                foundry.verify(root)

    def test_ignored_check_executable_resolves_from_check_working_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_project(Path(tmp))
            (root / 'tools').mkdir()
            (root / '.gitignore').write_text('tools/\n')
            executable = root / 'tools/runner'
            executable.write_text('#!/bin/sh\nexit 0\n')
            executable.chmod(0o755)
            foundry.atomic_json(root / '.foundry/project.json', {'checks':[{'name':'behavior','command':['./runner'],'cwd':'tools'}]})
            self.start(root)
            self.assertEqual(self.quiet(foundry.verify, root), 0)
            executable.write_text('#!/bin/sh\nexit 1\n')
            with self.assertRaisesRegex(foundry.Error, 'stale'):
                foundry.complete(root)

    def test_implicit_env_symlink_cannot_hide_mutable_input(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_project(Path(tmp))
            (root / 'shared-env').write_text('MODE=reviewed')
            (root / '.gitignore').write_text('.env\nshared-env\n')
            (root / '.env').symlink_to('shared-env')
            self.start(root)
            with self.assertRaisesRegex(foundry.Error, 'Symlink'):
                foundry.verify(root)

    def test_same_command_name_in_distinct_check_directories_is_independently_bound(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_project(Path(tmp))
            (root / '.gitignore').write_text('tools1/\ntools2/\n')
            configured = []
            for name in ('tools1', 'tools2'):
                (root / name).mkdir()
                runner = root / name / 'runner'
                runner.write_text('#!/bin/sh\nexit 0\n')
                runner.chmod(0o755)
                configured.append({'name':name, 'command':['./runner'], 'cwd':name})
            foundry.atomic_json(root / '.foundry/project.json', {'checks':configured})
            self.start(root)
            self.quiet(foundry.verify, root)
            (root / 'tools1/runner').write_text('#!/bin/sh\nexit 1\n')
            with self.assertRaisesRegex(foundry.Error, 'stale'):
                foundry.complete(root)

    def test_ignored_executable_mode_is_bound(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_project(Path(tmp))
            (root / '.gitignore').write_text('runner\n')
            runner = root / 'runner'
            runner.write_text('#!/bin/sh\nexit 0\n')
            runner.chmod(0o755)
            foundry.atomic_json(root / '.foundry/project.json', {'checks':[{'name':'behavior', 'command':[str(runner)]}]})
            self.start(root)
            self.quiet(foundry.verify, root)
            runner.chmod(0o644)
            with self.assertRaisesRegex(foundry.Error, 'stale'):
                foundry.complete(root)

    def test_lock_rejects_state_symlink_before_any_outside_write(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_project(Path(tmp))
            outside = Path(tmp) / 'outside'
            outside.mkdir()
            (root / '.foundry/state').symlink_to(outside, target_is_directory=True)
            with self.assertRaisesRegex(foundry.Error, 'Symlink'):
                self.start(root)
            self.assertEqual(list(outside.iterdir()), [])

    def test_installer_rejects_state_symlink_without_mutating_target(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(foundry, 'MANAGED', ['payload','scripts/foundry.py']):
            base = Path(tmp).resolve()
            source = self.make_source(base)
            target = base / 'target'
            (target / '.foundry').mkdir(parents=True)
            outside = base / 'outside'
            outside.mkdir()
            (target / '.foundry/state').symlink_to(outside, target_is_directory=True)
            before = runtime.tree(target)
            with self.assertRaisesRegex(foundry.Error, 'Symlink'):
                foundry.install(source, target, False)
            self.assertEqual(runtime.tree(target), before)
            self.assertEqual(list(outside.iterdir()), [])

    def test_pending_update_is_checked_at_lifecycle_lock_entry(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make_project(Path(tmp))
            checked_root = foundry.project_root(root)
            foundry.atomic_json(root / '.foundry/install-pending.json', {'incomplete':True})
            with self.assertRaisesRegex(foundry.Error, 'incomplete'):
                self.start(checked_root)

    def test_sigterm_stops_check_and_persists_interrupted_receipt(self):
        with tempfile.TemporaryDirectory() as tmp:
            code = 'import os,time; from pathlib import Path; Path(".foundry/state/check.pid").write_text(str(os.getpid())); print("started",flush=True); time.sleep(30)'
            root = self.make_project(Path(tmp), [{'name':'slow','command':[sys.executable,'-c',code],'timeout':40}])
            self.start(root)
            proc = subprocess.Popen([sys.executable,'-B',str(foundry.__file__),'--project',str(root),'verify'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            child = None
            try:
                deadline = time.monotonic() + 5
                while time.monotonic() < deadline and proc.poll() is None:
                    pidfile = root / '.foundry/state/check.pid'
                    if pidfile.exists():
                        child = int(pidfile.read_text())
                        break
                    time.sleep(.02)
                self.assertIsNotNone(child)
                proc.terminate()
                proc.communicate(timeout=5)
                state = foundry.active(root)[1]
                self.assertEqual(state['status'], 'paused')
                self.assertIn('verification', state)
                receipt = foundry.read_json(root / state['verification'])
                self.assertFalse(receipt['passed'])
                self.assertEqual(receipt['checks'][0]['status'], 'interrupted')
                with self.assertRaises(ProcessLookupError):
                    os.kill(child, 0)
            finally:
                if proc.poll() is None:
                    proc.kill()
                proc.communicate(timeout=5)
                if child:
                    try: os.killpg(child, signal.SIGKILL)
                    except ProcessLookupError: pass

    def test_update_interruption_blocks_use_and_rejects_changed_source(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(foundry, 'MANAGED', ['payload','scripts/foundry.py']):
            base = Path(tmp).resolve()
            source = self.make_source(base)
            target = base / 'target'
            self.quiet(foundry.install, source, target, False)
            (source / 'payload/file.txt').write_text('v2')
            original = foundry.os.replace
            def crash(src, dst):
                if str(dst).endswith('scripts/foundry.py'):
                    raise OSError('interrupted update')
                return original(src, dst)
            with mock.patch.object(foundry.os, 'replace', side_effect=crash):
                with self.assertRaises(OSError):
                    self.quiet(foundry.install, source, target, True)
            with self.assertRaisesRegex(foundry.Error, 'incomplete|interrupted'):
                foundry.project_root(target)
            (source / 'payload/file.txt').write_text('v3')
            with self.assertRaisesRegex(foundry.Error, 'source|update'):
                self.quiet(foundry.install, source, target, True)
            (source / 'payload/file.txt').write_text('v2')
            self.assertEqual(self.quiet(foundry.install, source, target, True), 0)
            self.assertEqual(foundry.project_root(target), target)
            self.assertEqual((target / 'payload/file.txt').read_text(), 'v2')


if __name__ == '__main__':
    unittest.main()
