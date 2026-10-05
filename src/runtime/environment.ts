const BASE_ENVIRONMENT = [
  'PATH', 'HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'SystemRoot', 'WINDIR',
  'PATHEXT', 'TMP', 'TEMP', 'TMPDIR', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ', 'TERM',
];

export function providerEnvironment(
  adapter: { name: string; environment?: readonly string[] },
  billing: string,
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const names = new Set([...BASE_ENVIRONMENT, ...(adapter.environment ?? [])]);
  if (adapter.name === 'codex') {
    names.add('CODEX_HOME');
    if (billing === 'api') {
      names.add('OPENAI_API_KEY');
      names.add('CODEX_API_KEY');
    }
  }
  if (adapter.name === 'codex' && billing !== 'api') {
    names.delete('OPENAI_API_KEY');
    names.delete('CODEX_API_KEY');
  }
  return Object.fromEntries([...names].flatMap(name => source[name] === undefined ? [] : [[name, source[name]]]));
}
