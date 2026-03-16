// server.ts
import path2 from "path";
import { fileURLToPath } from "url";
import express2 from "express";

// server/app.ts
import express from "express";

// server/lib/auth.ts
function validateApiKey(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const key = authHeader.slice(7).trim();
  if (!key) return false;
  const validKeys = (process.env.API_KEYS || "").split(",").map((k) => k.trim()).filter(Boolean);
  if (validKeys.length === 0) return false;
  return validKeys.includes(key);
}
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

// server/lib/providers.ts
var Z_IMAGE_NEGATIVE_PROMPT = "worst quality, low quality, JPEG compression artifacts, ugly, incomplete, extra fingers, poorly drawn hands, poorly drawn face, deformed, disfigured, malformed limbs, fused fingers, cluttered background, three legs";
function sizeToAspectRatio(w, h) {
  const ratio = w / h;
  if (Math.abs(ratio - 1) < 0.05) return "1:1";
  if (Math.abs(ratio - 16 / 9) < 0.1) return "16:9";
  if (Math.abs(ratio - 9 / 16) < 0.1) return "9:16";
  if (Math.abs(ratio - 4 / 3) < 0.1) return "4:3";
  if (Math.abs(ratio - 3 / 4) < 0.1) return "3:4";
  if (Math.abs(ratio - 3 / 2) < 0.1) return "3:2";
  if (Math.abs(ratio - 2 / 3) < 0.1) return "2:3";
  return "1:1";
}
var PROVIDER_CONFIGS = {
  huggingface: {
    type: "gradio",
    envKey: "PROVIDER_TOKENS_HF",
    modelMap: {
      "z-image-turbo": "z-image-turbo",
      "z-image": "z-image",
      "qwen-image": "qwen-image",
      "ovis-image": "ovis-image",
      "flux-1-schnell": "flux-1-schnell"
    },
    gradioModels: {
      "z-image-turbo": {
        spaceUrl: "https://luca115-z-image-turbo.hf.space",
        fnIndex: 1,
        triggerId: 16,
        buildData: (prompt, _w, h, seed, steps, _g) => [prompt, h, _w, steps, seed, false]
      },
      "z-image": {
        spaceUrl: "https://mrfakename-z-image.hf.space",
        fnIndex: 2,
        triggerId: 18,
        buildData: (prompt, _w, h, seed, steps, guidance) => [
          prompt,
          Z_IMAGE_NEGATIVE_PROMPT,
          h,
          _w,
          steps,
          guidance || 4,
          seed,
          false
        ]
      },
      "qwen-image": {
        spaceUrl: "https://mcp-tools-qwen-image-fast.hf.space",
        fnIndex: 1,
        triggerId: 6,
        buildData: (prompt, w, h, seed, steps, _g) => [
          prompt,
          seed,
          false,
          // randomize
          sizeToAspectRatio(w, h),
          3,
          steps || 8
        ]
      },
      "ovis-image": {
        spaceUrl: "https://aidc-ai-ovis-image-7b.hf.space",
        fnIndex: 2,
        triggerId: 5,
        buildData: (prompt, w, h, seed, steps, _g) => [prompt, h, w, seed, steps || 24, 4]
      },
      "flux-1-schnell": {
        spaceUrl: "https://black-forest-labs-flux-1-schnell.hf.space",
        fnIndex: 2,
        triggerId: 5,
        buildData: (prompt, w, h, seed, steps, _g) => [prompt, seed, false, w, h, steps || 4]
      }
    }
  },
  gitee: {
    type: "rest",
    generateUrl: "https://ai.gitee.com/v1/images/generations",
    envKey: "PROVIDER_TOKENS_GITEE",
    modelMap: {
      "z-image-turbo": "z-image-turbo",
      "qwen-image": "Qwen-Image",
      "flux-2": "FLUX.2-dev",
      "flux-1-schnell": "flux-1-schnell",
      "flux-1-krea": "FLUX_1-Krea-dev",
      "flux-1": "FLUX.1-dev"
    }
  },
  modelscope: {
    type: "rest",
    generateUrl: "https://api-inference.modelscope.cn/v1/images/generations",
    envKey: "PROVIDER_TOKENS_MODELSCOPE",
    modelMap: {
      "z-image-turbo": "Tongyi-MAI/Z-Image-Turbo",
      "z-image": "Tongyi-MAI/Z-Image",
      "flux-2": "black-forest-labs/FLUX.2-dev",
      "flux-1-krea": "black-forest-labs/FLUX.1-Krea-dev",
      "flux-1": "MusePublic/489_ckpt_FLUX_1"
    }
  },
  a4f: {
    type: "rest",
    generateUrl: "https://api.a4f.co/v1/images/generations",
    envKey: "PROVIDER_TOKENS_A4F",
    modelMap: {
      "z-image-turbo": "provider-8/z-image",
      "imagen-4": "provider-8/imagen-4",
      "imagen-3.5": "provider-4/imagen-3.5"
    }
  }
};
var MODEL_LABELS = {
  "z-image-turbo": "Z-Image Turbo",
  "z-image": "Z-Image",
  "qwen-image": "Qwen Image",
  "ovis-image": "Ovis Image",
  "flux-2": "FLUX.2",
  "flux-1-schnell": "FLUX.1 Schnell",
  "flux-1-krea": "FLUX.1 Krea",
  "flux-1": "FLUX.1",
  "imagen-4": "Google Imagen 4",
  "imagen-3.5": "Google Imagen 3.5"
};
function getTokens(provider) {
  const config = PROVIDER_CONFIGS[provider];
  return (process.env[config.envKey] || "").split(",").map((t) => t.trim()).filter(Boolean);
}
function resolveModel(modelId) {
  if (!modelId) modelId = "z-image-turbo";
  const providerOrder = ["gitee", "a4f", "modelscope", "huggingface"];
  for (const pid of providerOrder) {
    const config = PROVIDER_CONFIGS[pid];
    if (config.modelMap[modelId]) {
      const tokens = getTokens(pid);
      if (tokens.length > 0 || pid === "huggingface") {
        return { provider: pid, apiModel: config.modelMap[modelId], modelId };
      }
    }
  }
  return null;
}
function getAvailableModels() {
  const modelProviders = /* @__PURE__ */ new Map();
  for (const [pid, config] of Object.entries(PROVIDER_CONFIGS)) {
    const tokens = getTokens(pid);
    if (tokens.length === 0 && pid !== "huggingface") continue;
    for (const modelId of Object.keys(config.modelMap)) {
      const existing = modelProviders.get(modelId) || [];
      existing.push(pid);
      modelProviders.set(modelId, existing);
    }
  }
  return Array.from(modelProviders.entries()).map(([id, providers]) => ({
    id,
    label: MODEL_LABELS[id] || id,
    providers
  }));
}
function parseSize(size) {
  const match = size.match(/^(\d+)x(\d+)$/);
  if (match) {
    return { width: parseInt(match[1]), height: parseInt(match[2]) };
  }
  return { width: 1024, height: 1024 };
}
async function runGradioTask(spaceUrl, data, fnIndex, triggerId, token) {
  const sessionHash = Date.now().toString(16) + Math.random().toString(16).slice(2, 8);
  const joinRes = await fetch(`${spaceUrl}/gradio_api/queue/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...token ? { Authorization: `Bearer ${token}` } : {}
    },
    body: JSON.stringify({
      data,
      fn_index: fnIndex,
      trigger_id: triggerId,
      session_hash: sessionHash,
      event_data: null
    })
  });
  if (!joinRes.ok) {
    if (joinRes.status === 429) throw new Error("429 rate limited");
    throw new Error(`Gradio join failed: ${joinRes.status}`);
  }
  const sseRes = await fetch(`${spaceUrl}/gradio_api/queue/data?session_hash=${sessionHash}`, {
    headers: {
      Accept: "text/event-stream",
      ...token ? { Authorization: `Bearer ${token}` } : {}
    }
  });
  if (!sseRes.ok) {
    if (sseRes.status === 429) throw new Error("429 rate limited");
    throw new Error(`Gradio SSE failed: ${sseRes.status}`);
  }
  const reader = sseRes.body?.getReader();
  if (!reader) throw new Error("No response body from Gradio stream");
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;
        try {
          const msg = JSON.parse(jsonStr);
          if (msg.msg === "process_completed") {
            if (msg.success) {
              return msg.output;
            }
            const output = msg.output || {};
            const detail = output[" "] || output.error || "";
            const title = msg.title || output.title || "Gradio task failed";
            const fullMessage = detail ? `${title}: ${detail}` : title;
            if (fullMessage.includes("exceeded your free GPU quota")) {
              throw new Error("429 quota exhausted");
            }
            throw new Error(fullMessage);
          }
        } catch (e) {
          if (e instanceof Error && (e.message.includes("429") || e.message.includes("failed") || e.message.includes("Gradio"))) {
            throw e;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  throw new Error("Gradio stream closed without result");
}
async function generateViaHuggingFace(modelId, token, prompt, size, _n, responseFormat, extra) {
  const hfConfig = PROVIDER_CONFIGS.huggingface;
  const gradioConfig = hfConfig.gradioModels[modelId];
  if (!gradioConfig) {
    throw new Error(`HuggingFace model ${modelId} not configured`);
  }
  const { width, height } = parseSize(size);
  const seed = extra.seed ?? Math.floor(Math.random() * 2147483647);
  const steps = extra.steps || extra.num_inference_steps || 9;
  const guidance = extra.guidance_scale || extra.guidance || 4;
  const data = gradioConfig.buildData(prompt, width, height, seed, steps, guidance);
  const output = await runGradioTask(
    gradioConfig.spaceUrl,
    data,
    gradioConfig.fnIndex,
    gradioConfig.triggerId,
    token
  );
  const outputData = output.data;
  if (!outputData || !outputData[0]) {
    throw new Error("No image data in Gradio response");
  }
  let imageUrl = null;
  const first = outputData[0];
  if (typeof first === "string") {
    imageUrl = first;
  } else if (first.url) {
    imageUrl = first.url;
  } else if (first.image?.url) {
    imageUrl = first.image.url;
  }
  if (!imageUrl) {
    throw new Error("Could not extract image URL from Gradio response");
  }
  if (responseFormat === "b64_json") {
    const imgRes = await fetch(imageUrl);
    const buf = await imgRes.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    return {
      created: Math.floor(Date.now() / 1e3),
      data: [{ b64_json: b64 }]
    };
  }
  return {
    created: Math.floor(Date.now() / 1e3),
    data: [{ url: imageUrl }]
  };
}
async function generateViaGitee(apiModel, token, prompt, size, _n, responseFormat, extra) {
  const { width, height } = parseSize(size);
  const config = PROVIDER_CONFIGS.gitee;
  const body = {
    prompt,
    model: apiModel,
    width,
    height,
    response_format: responseFormat === "b64_json" ? "b64_json" : "url"
  };
  if (extra.seed != null) body.seed = extra.seed;
  if (extra.num_inference_steps != null) body.num_inference_steps = extra.num_inference_steps;
  else if (extra.steps != null) body.num_inference_steps = extra.steps;
  if (extra.guidance_scale != null) body.guidance_scale = extra.guidance_scale;
  const response = await fetch(config.generateUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || err.error?.message || `Gitee API Error: ${response.status}`);
  }
  return response.json();
}
async function generateViaA4F(apiModel, token, prompt, size, n, responseFormat, _extra) {
  const config = PROVIDER_CONFIGS.a4f;
  const body = {
    model: apiModel,
    prompt,
    n,
    size,
    response_format: responseFormat === "b64_json" ? "b64_json" : "url"
  };
  const response = await fetch(config.generateUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || err.message || `A4F API Error: ${response.status}`);
  }
  return response.json();
}
async function pollMsTask(taskId, token) {
  const statusUrl = `https://api-inference.modelscope.cn/v1/tasks/${taskId}`;
  const maxPollTime = 1e5;
  const startTime = Date.now();
  while (Date.now() - startTime < maxPollTime) {
    const res = await fetch(statusUrl, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-ModelScope-Task-Type": "image_generation"
      }
    });
    if (!res.ok) throw new Error(`Task status check failed: ${res.status}`);
    const data = await res.json();
    if (data.task_status === "SUCCEED") {
      if (!data.output_images || data.output_images.length === 0) {
        throw new Error("No images returned");
      }
      return data.output_images;
    }
    if (data.task_status === "FAILED") {
      throw new Error(data.message || "Generation failed");
    }
    await new Promise((r) => setTimeout(r, 3e3));
  }
  throw new Error("Generation timed out");
}
async function generateViaModelScope(apiModel, token, prompt, size, _n, responseFormat, extra) {
  const config = PROVIDER_CONFIGS.modelscope;
  const body = { prompt, model: apiModel, size };
  if (extra.seed != null) body.seed = extra.seed;
  if (extra.steps != null) body.steps = extra.steps;
  else if (extra.num_inference_steps != null) body.steps = extra.num_inference_steps;
  if (extra.guidance_scale != null) body.guidance = extra.guidance_scale;
  else if (extra.guidance != null) body.guidance = extra.guidance;
  const response = await fetch(config.generateUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-ModelScope-Async-Mode": "true"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || err.error?.message || `ModelScope API Error: ${response.status}`);
  }
  const initData = await response.json();
  if (initData.data && initData.data[0]) return initData;
  if (!initData.task_id) throw new Error("No task_id or image data returned");
  const imageUrls = await pollMsTask(initData.task_id, token);
  if (responseFormat === "b64_json") {
    const data = await Promise.all(
      imageUrls.map(async (url) => {
        const imgRes = await fetch(url);
        const buf = await imgRes.arrayBuffer();
        return { b64_json: Buffer.from(buf).toString("base64") };
      })
    );
    return { created: Math.floor(Date.now() / 1e3), data };
  }
  return {
    created: Math.floor(Date.now() / 1e3),
    data: imageUrls.map((url) => ({ url }))
  };
}
var REST_GENERATORS = {
  gitee: generateViaGitee,
  a4f: generateViaA4F,
  modelscope: generateViaModelScope
};
async function generateImage(resolved, prompt, size, n, responseFormat, extra) {
  if (resolved.provider === "huggingface") {
    const tokens2 = getTokens("huggingface");
    const tokenList = tokens2.length > 0 ? tokens2 : [null];
    let lastError2 = null;
    for (const token of tokenList) {
      try {
        return await generateViaHuggingFace(
          resolved.modelId,
          token,
          prompt,
          size,
          n,
          responseFormat,
          extra
        );
      } catch (err) {
        lastError2 = err;
        if (err.message?.includes("429")) continue;
        throw err;
      }
    }
    throw lastError2 || new Error("HuggingFace generation failed");
  }
  const tokens = getTokens(resolved.provider);
  if (tokens.length === 0) throw new Error(`No tokens configured for ${resolved.provider}`);
  let lastError = null;
  const generator = REST_GENERATORS[resolved.provider];
  for (const token of tokens) {
    try {
      return await generator(resolved.apiModel, token, prompt, size, n, responseFormat, extra);
    } catch (err) {
      lastError = err;
      const isQuota = err.message?.includes("429") || err.message?.includes("quota") || err.message?.includes("credit") || err.message?.includes("insufficient");
      if (isQuota) continue;
      throw err;
    }
  }
  throw lastError || new Error("No available tokens");
}

// server/lib/cache.ts
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import sharp from "sharp";
var CACHE_DIR = path.join(os.tmpdir(), "peinture-cache");
var MAX_AGE_MS = 3 * 24 * 60 * 60 * 1e3;
fs.mkdirSync(CACHE_DIR, { recursive: true });
function getCacheDir() {
  return CACHE_DIR;
}
async function cacheImage(imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to download image: ${res.status}`);
  }
  const srcBuffer = Buffer.from(await res.arrayBuffer());
  const pngBuffer = await sharp(srcBuffer).png().toBuffer();
  const filename = crypto.randomUUID() + ".png";
  fs.writeFileSync(path.join(CACHE_DIR, filename), pngBuffer);
  return filename;
}
function cleanupCache() {
  try {
    const now = Date.now();
    for (const file of fs.readdirSync(CACHE_DIR)) {
      const fp = path.join(CACHE_DIR, file);
      try {
        if (now - fs.statSync(fp).mtimeMs > MAX_AGE_MS) {
          fs.unlinkSync(fp);
        }
      } catch {
      }
    }
  } catch (e) {
    console.error("Cache cleanup error:", e);
  }
}
setInterval(cleanupCache, 60 * 60 * 1e3);

// server/app.ts
var app = express();
app.use(express.json());
app.use("/images", express.static(getCacheDir()));
app.use((_req, res, next) => {
  const h = corsHeaders();
  Object.entries(h).forEach(([k, v]) => res.setHeader(k, v));
  if (_req.method === "OPTIONS") return res.sendStatus(200);
  next();
});
function requireAuth(req, res, next) {
  if (!validateApiKey(req.headers.authorization)) {
    return res.status(401).json({
      error: {
        message: "Incorrect API key provided.",
        type: "invalid_authentication_error",
        code: "invalid_api_key"
      }
    });
  }
  next();
}
app.get("/v1/models", requireAuth, (_req, res) => {
  const models = getAvailableModels();
  res.json({
    object: "list",
    data: models.map((m) => ({
      id: m.id,
      object: "model",
      created: 17e8,
      owned_by: "peinture"
    }))
  });
});
app.post("/v1/images/generations", requireAuth, async (req, res) => {
  const {
    model,
    prompt,
    n = 1,
    size = "1024x1024",
    response_format = "url",
    ...extra
  } = req.body || {};
  if (!prompt) {
    return res.status(400).json({
      error: {
        message: "'prompt' is a required parameter.",
        type: "invalid_request_error",
        param: "prompt"
      }
    });
  }
  const resolved = resolveModel(model || "z-image-turbo");
  if (!resolved) {
    return res.status(400).json({
      error: {
        message: `Model '${model || "z-image-turbo"}' is not available. Ensure the required provider tokens are configured as environment variables.`,
        type: "invalid_request_error",
        param: "model"
      }
    });
  }
  try {
    const result = await generateImage(resolved, prompt, size, n, response_format, extra);
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const baseUrl = `${proto}://${host}`;
    const data = await Promise.all(
      (result.data || []).map(async (item) => {
        const entry = {};
        if (item.url) {
          try {
            const filename = await cacheImage(item.url);
            entry.url = `${baseUrl}/images/${filename}`;
          } catch (e) {
            console.warn("Image cache failed, using original URL:", e);
            entry.url = item.url;
          }
        }
        if (item.b64_json) entry.b64_json = item.b64_json;
        if (item.revised_prompt) entry.revised_prompt = item.revised_prompt;
        return entry;
      })
    );
    res.json({
      created: result.created || Math.floor(Date.now() / 1e3),
      data
    });
  } catch (error) {
    console.error("Image generation error:", error);
    const status = error.message?.includes("429") ? 429 : 500;
    res.status(status).json({
      error: {
        message: error.message || "Image generation failed.",
        type: "server_error"
      }
    });
  }
});
var app_default = app;

// server.ts
var __dirname = path2.dirname(fileURLToPath(import.meta.url));
var distPath = path2.join(__dirname, "dist");
app_default.use(express2.static(distPath));
app_default.get("*", (_req, res) => {
  res.sendFile(path2.join(distPath, "index.html"));
});
var port = process.env.PORT || 3e3;
app_default.listen(port, () => {
  console.log(`Peinture server running on http://localhost:${port}`);
});
