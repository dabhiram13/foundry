#!/usr/bin/env python3
"""Run unittest discovery and optionally emit the runtime's execution report."""
import argparse
import json
import os
from pathlib import Path
import sys
import unittest


class Result(unittest.TextTestResult):
    def __init__(self, *args):
        super().__init__(*args)
        self.failed_cases = set()
        self.skipped_cases = set()

    def addSkip(self, test, reason):
        self.skipped_cases.add(self.testsRun)
        super().addSkip(test, reason)

    def addExpectedFailure(self, test, error):
        self.skipped_cases.add(self.testsRun)
        super().addExpectedFailure(test, error)

    def addFailure(self, test, error):
        self.failed_cases.add(self.testsRun)
        super().addFailure(test, error)

    def addError(self, test, error):
        self.failed_cases.add(self.testsRun)
        super().addError(test, error)

    def addUnexpectedSuccess(self, test):
        self.failed_cases.add(self.testsRun)
        super().addUnexpectedSuccess(test)

    def addSubTest(self, test, subtest, error):
        if error is not None:
            self.failed_cases.add(self.testsRun)
        super().addSubTest(test, subtest, error)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--start', default='tests')
    parser.add_argument('--pattern', default='test*.py')
    args = parser.parse_args()
    # Match ``python -m unittest``: script execution otherwise exposes only
    # scripts/ and the discovery directory, breaking project package imports.
    sys.path.insert(0, str(Path.cwd()))
    suite = unittest.defaultTestLoader.discover(args.start, pattern=args.pattern)
    result = unittest.TextTestRunner(verbosity=2, resultclass=Result).run(suite)
    skipped = len(result.skipped_cases)
    executed = result.testsRun - len(result.skipped_cases - result.failed_cases)
    failed = len(result.failed_cases)
    report_path = os.environ.get('FOUNDRY_TEST_REPORT')
    if report_path:
        report = Path(report_path)
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(json.dumps({'run_id': os.environ.get('FOUNDRY_CHECK_ID'),
            'tests': {'executed': executed, 'passed': executed - failed,
                      'failed': failed, 'skipped': skipped}}))
    return 0 if result.wasSuccessful() and executed > 0 and not skipped else 1


if __name__ == '__main__':
    raise SystemExit(main())
