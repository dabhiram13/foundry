"""Exercise the CI checkout trust boundary with real Git and index scans."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class CheckoutTrustTests(unittest.TestCase):
    def test_job_trust_is_workspace_scoped_and_preserves_index_scan(self):
        workflow = (ROOT / '.github/workflows/verify.yml').read_text().splitlines()
        marker = '      - name: Trust checked-out workspace'
        self.assertIn(marker, workflow, 'Later steps need persistent workspace-scoped Git trust')
        command = workflow[workflow.index(marker) + 1].strip().removeprefix('run: ')
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp).resolve()
            env = {k: v for k, v in os.environ.items() if not k.startswith('GIT_CONFIG')}
            env.update(GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=str(base / 'job.gitconfig'))
            repo = base / 'checkout with spaces'
            other = base / 'unrelated checkout'
            for directory in (repo, other):
                directory.mkdir()
                subprocess.run(['git', 'init', '-q'], cwd=directory, env=env, check=True)
            target = repo / 'file with spaces.txt'
            target.write_text('clean\n')
            subprocess.run(['git', 'add', '--', target.name], cwd=repo, env=env, check=True)
            env.update(GIT_TEST_ASSUME_DIFFERENT_OWNER='1', GITHUB_WORKSPACE=str(repo))

            def scan(scan_env):
                return subprocess.run([sys.executable, str(ROOT / 'scripts/security_scan.py'),
                                       '--root', str(repo), '--whole-tracked'],
                                      env=scan_env, capture_output=True, text=True)

            # Checkout's temporary config works only for that action's Git calls.
            checkout_env = dict(env, GIT_CONFIG_GLOBAL=str(base / 'checkout.gitconfig'))
            subprocess.run(['git', 'config', '--global', '--add', 'safe.directory', str(repo)],
                           env=checkout_env, check=True)
            self.assertEqual(scan(checkout_env).returncode, 0)
            untrusted = scan(env)
            self.assertEqual(untrusted.returncode, 2)
            self.assertIn('dubious ownership', untrusted.stderr)

            # Execute the actual job step; no automatic trust is added by the scanner.
            subprocess.run(['sh', '-eu', '-c', command], cwd=repo, env=env, check=True)
            self.assertEqual(scan(env).returncode, 0)
            configured = subprocess.check_output(['git', 'config', '--global', '--get-all',
                                                  'safe.directory'], env=env, text=True)
            self.assertEqual(configured.splitlines(), [str(repo)])
            denied = subprocess.run(['git', 'ls-files'], cwd=other, env=env,
                                    capture_output=True, text=True)
            self.assertNotEqual(denied.returncode, 0)
            self.assertIn('dubious ownership', denied.stderr)

            secret = 'sk-proj-' + 'syntheticfixture12345678901234567890'
            target.write_text(secret + '\n')
            subprocess.run(['git', 'add', '--', target.name], cwd=repo, env=env, check=True)
            target.write_text('clean worktree, secret remains staged\n')
            blocked = scan(env)
            self.assertEqual(blocked.returncode, 1)
            self.assertIn('OpenAI API key [REDACTED]', blocked.stderr)
            self.assertNotIn(secret, blocked.stdout + blocked.stderr)
