export function validateApiKey(authHeader: string | undefined | null): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const key = authHeader.slice(7).trim();
  if (!key) return false;

  const validKeys = (process.env.API_KEYS || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  if (validKeys.length === 0) return false;
  return validKeys.includes(key);
}

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
