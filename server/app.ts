import express from 'express';
import { validateApiKey, corsHeaders } from './lib/auth';
import { resolveModel, generateImage, getAvailableModels } from './lib/providers';
import { cacheImage, getCacheDir } from './lib/cache';

const app = express();
app.use(express.json());

// Serve cached images
app.use('/images', express.static(getCacheDir()));

// CORS
app.use((_req, res, next) => {
  const h = corsHeaders();
  Object.entries(h).forEach(([k, v]) => res.setHeader(k, v));
  if (_req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Auth middleware for /v1/*
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!validateApiKey(req.headers.authorization)) {
    return res.status(401).json({
      error: {
        message: 'Incorrect API key provided.',
        type: 'invalid_authentication_error',
        code: 'invalid_api_key',
      },
    });
  }
  next();
}

// GET /v1/models
app.get('/v1/models', requireAuth, (_req, res) => {
  const models = getAvailableModels();
  res.json({
    object: 'list',
    data: models.map(m => ({
      id: m.id,
      object: 'model',
      created: 1700000000,
      owned_by: 'peinture',
    })),
  });
});

// POST /v1/images/generations
app.post('/v1/images/generations', requireAuth, async (req, res) => {
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

  const resolved = resolveModel(model || 'z-image-turbo');
  if (!resolved) {
    return res.status(400).json({
      error: {
        message: `Model '${model || 'z-image-turbo'}' is not available. Ensure the required provider tokens are configured as environment variables.`,
        type: 'invalid_request_error',
        param: 'model',
      },
    });
  }

  try {
    const result = await generateImage(resolved, prompt, size, n, response_format, extra);

    // Build base URL for local image serving
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const baseUrl = `${proto}://${host}`;

    // Process each image: download upstream URL → cache locally → return local URL
    const data = await Promise.all(
      (result.data || []).map(async (item: any) => {
        const entry: any = {};

        if (item.url) {
          try {
            const filename = await cacheImage(item.url);
            entry.url = `${baseUrl}/images/${filename}`;
          } catch (e) {
            // Fallback to original URL if caching fails
            console.warn('Image cache failed, using original URL:', e);
            entry.url = item.url;
          }
        }

        if (item.b64_json) entry.b64_json = item.b64_json;
        if (item.revised_prompt) entry.revised_prompt = item.revised_prompt;
        return entry;
      })
    );

    res.json({
      created: result.created || Math.floor(Date.now() / 1000),
      data,
    });
  } catch (error: any) {
    console.error('Image generation error:', error);
    const status = error.message?.includes('429') ? 429 : 500;
    res.status(status).json({
      error: {
        message: error.message || 'Image generation failed.',
        type: 'server_error',
      },
    });
  }
});

export default app;
