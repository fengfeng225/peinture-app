import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateApiKey, corsHeaders } from '../_lib/auth';
import { getAvailableModels } from '../_lib/providers';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders();
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v as string));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: { message: 'Method not allowed', type: 'invalid_request_error' },
    });
  }

  // Auth check
  if (!validateApiKey(req.headers.authorization)) {
    return res.status(401).json({
      error: {
        message: 'Incorrect API key provided.',
        type: 'invalid_authentication_error',
        code: 'invalid_api_key',
      },
    });
  }

  const models = getAvailableModels();

  return res.status(200).json({
    object: 'list',
    data: models.map(m => ({
      id: m.id,
      object: 'model',
      created: 1700000000,
      owned_by: 'peinture',
    })),
  });
}
