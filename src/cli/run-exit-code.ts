export function projectRunExitCode(status: unknown): number {
  if (status === 'interrupted') return 130;
  if (status === 'failed' || status === 'recovery_required') return 1;
  return 0;
}
