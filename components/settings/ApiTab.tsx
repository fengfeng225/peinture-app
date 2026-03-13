
import React, { useState, useCallback } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { translations } from '../../translations';

export const ApiTab: React.FC = () => {
    const { language } = useAppStore();
    const t = translations[language];

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.vercel.app';

    const [copiedField, setCopiedField] = useState<string | null>(null);

    const copyToClipboard = useCallback((text: string, field: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        });
    }, []);

    const CopyButton: React.FC<{ text: string; field: string }> = ({ text, field }) => (
        <button
            onClick={() => copyToClipboard(text, field)}
            className="p-1.5 rounded-md text-white/30 hover:text-white hover:bg-white/10 transition-all"
            title={t.copy}
        >
            {copiedField === field ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
    );

    return (
        <div className="space-y-6">
            {/* API Endpoint Info */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/80">{t.api_endpoint}</h3>
                <div className="space-y-2">
                    <label className="text-xs text-white/50">Base URL</label>
                    <div className="flex items-center gap-2 bg-[#1A1625] border border-white/10 rounded-lg px-3 py-2">
                        <code className="flex-1 text-sm text-purple-300 font-mono truncate">{baseUrl}</code>
                        <CopyButton text={baseUrl} field="baseUrl" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs text-white/50">{t.api_models_endpoint}</label>
                    <div className="flex items-center gap-2 bg-[#1A1625] border border-white/10 rounded-lg px-3 py-2">
                        <code className="flex-1 text-sm text-white/60 font-mono truncate">GET /v1/models</code>
                        <CopyButton text={`${baseUrl}/v1/models`} field="modelsUrl" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs text-white/50">{t.api_gen_endpoint}</label>
                    <div className="flex items-center gap-2 bg-[#1A1625] border border-white/10 rounded-lg px-3 py-2">
                        <code className="flex-1 text-sm text-white/60 font-mono truncate">POST /v1/images/generations</code>
                        <CopyButton text={`${baseUrl}/v1/images/generations`} field="genUrl" />
                    </div>
                </div>
            </div>

            {/* Environment Variables Setup */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/80">{t.api_env_setup}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{t.api_env_desc}</p>

                <div className="space-y-2">
                    {[
                        { key: 'API_KEYS', desc: t.api_env_apikeys_desc, example: 'sk-key1,sk-key2' },
                        { key: 'PROVIDER_TOKENS_GITEE', desc: 'Gitee AI tokens', example: 'token1,token2' },
                        { key: 'PROVIDER_TOKENS_A4F', desc: 'A4F tokens', example: 'ddc-xxx' },
                        { key: 'PROVIDER_TOKENS_MODELSCOPE', desc: 'ModelScope tokens', example: 'ms-xxx' },
                        { key: 'PROVIDER_TOKENS_HF', desc: 'HuggingFace tokens (optional)', example: 'hf_xxx' },
                    ].map(({ key, desc, example }) => (
                        <div key={key} className="bg-white/[0.03] border border-white/5 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                                <code className="text-xs font-mono text-purple-300">{key}</code>
                                <CopyButton text={key} field={`env-${key}`} />
                            </div>
                            <p className="text-[11px] text-white/40">{desc}</p>
                            <p className="text-[11px] text-white/25 font-mono mt-0.5">{t.api_example}: {example}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Available Models */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/80">{t.api_available_models}</h3>
                <div className="bg-white/[0.03] border border-white/5 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="text-left px-3 py-2 text-white/40 font-medium">Model ID</th>
                                <th className="text-left px-3 py-2 text-white/40 font-medium">{t.api_providers}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { id: 'z-image-turbo', providers: 'Gitee / A4F / MS / HF' },
                                { id: 'z-image', providers: 'MS / HF' },
                                { id: 'qwen-image', providers: 'Gitee / HF' },
                                { id: 'ovis-image', providers: 'HF' },
                                { id: 'flux-2', providers: 'Gitee / MS' },
                                { id: 'flux-1-schnell', providers: 'Gitee / HF' },
                                { id: 'flux-1-krea', providers: 'Gitee / MS' },
                                { id: 'flux-1', providers: 'Gitee / MS' },
                                { id: 'imagen-4', providers: 'A4F' },
                                { id: 'imagen-3.5', providers: 'A4F' },
                            ].map(({ id, providers }) => (
                                <tr key={id} className="border-b border-white/[0.03] last:border-0">
                                    <td className="px-3 py-1.5 font-mono text-white/70">{id}</td>
                                    <td className="px-3 py-1.5 text-white/40">{providers}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Cherry Studio Guide */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/80">{t.api_cherry_studio}</h3>
                <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3 space-y-2 text-xs text-white/50">
                    <p>1. {t.api_cherry_step1}</p>
                    <p>2. {t.api_cherry_step2} <code className="text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded">{baseUrl}</code></p>
                    <p>3. {t.api_cherry_step3}</p>
                    <p>4. {t.api_cherry_step4}</p>
                </div>
            </div>

            {/* New API Guide */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/80">{t.api_newapi}</h3>
                <div className="bg-white/[0.03] border border-white/5 rounded-lg p-3 space-y-2 text-xs text-white/50">
                    <p>1. {t.api_newapi_step1}</p>
                    <p>2. {t.api_newapi_step2} <code className="text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded">{baseUrl}</code></p>
                    <p>3. {t.api_newapi_step3}</p>
                    <p>4. {t.api_newapi_step4}</p>
                </div>
            </div>

            {/* cURL Example */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white/80">{t.api_curl_example}</h3>
                    <CopyButton
                        text={`curl ${baseUrl}/v1/images/generations \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -d '{"model": "z-image-turbo", "prompt": "A cat in space", "size": "1024x1024"}'`}
                        field="curl"
                    />
                </div>
                <pre className="bg-[#1A1625] border border-white/10 rounded-lg p-3 text-[11px] text-white/60 font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
{`curl ${baseUrl}/v1/images/generations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "model": "z-image-turbo",
    "prompt": "A cat in space",
    "size": "1024x1024"
  }'`}
                </pre>
            </div>

            {/* Vercel Dashboard Link */}
            <a
                href="https://vercel.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 rounded-lg text-sm text-white/60 hover:text-white transition-all"
            >
                {t.api_open_vercel}
                <ExternalLink className="w-3.5 h-3.5" />
            </a>
        </div>
    );
};
