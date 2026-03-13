import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateApiKey, corsHeaders } from '../../_lib/auth';
import { resolveModel, generateImage } from '../../_lib/providers';

export const config = {
  maxDuration: 120,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders();
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v as string));

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: { message: 'Method not allowed', type: 'invalid_request_error' },
    });
  }

  // Auth
  if (!validateApiKey(req.headers.authorization)) {
    return res.status(401).json({
      error: {
        message: 'Incorrect API key provided.',
        type: 'invalid_authentication_error',
        code: 'invalid_api_key',
      },
    });
  }

  // Parse body
  const {
    model,
    prompt,
    n = 1,
    size = '1024x1024',
    response_format = 'url',
    ...extra
  } = req.body || {};

  if (!prompt) {
    return res.status(400).json({
      error: {
        message: "'prompt' is a required parameter.",
        type: 'invalid_request_error',
        param: 'prompt',
      },
    });
  }

  // Resolve model to a provider
  const resolved = resolveModel(model || 'z-image-turbo');
  if (!resolved) {
    return res.status(400).json({
      error: {
        message: `Model '${model || 'z-image-turbo'}' is not available. Ensure the required provider tokens are configured as environment variables (PROVIDER_TOKENS_GITEE, PROVIDER_TOKENS_MODELSCOPE, or PROVIDER_TOKENS_A4F).`,
        type: 'invalid_request_error',
        param: 'model',
      },
    });
  }

  try {
    const result = await generateImage(resolved, prompt, size, n, response_format, extra);

    // Ensure standard OpenAI response format
    const responseData = {
      created: result.created || Math.floor(Date.now() / 1000),
      data: (result.data || []).map((item: any) => {
        const entry: any = {};
        if (item.url) entry.url = item.url;
        if (item.b64_json) entry.b64_json = item.b64_json;
        if (item.revised_prompt) entry.revised_prompt = item.revised_prompt;
        return entry;
      }),
    };

    return res.status(200).json(responseData);
  } catch (error: any) {
    console.error('Image generation error:', error);

    const status = error.message?.includes('429') ? 429 : 500;
    return res.status(status).json({
      error: {
        message: error.message || 'Image generation failed.',
        type: 'server_error',
      },
    });
  }
}
