
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppView } from '../components/Header';
import { Language } from '../translations';
import { 
    AspectRatioOption, CloudImage, GeneratedImage, ModelOption, ProviderOption, ProviderId, TokenStatus,
    StorageType, S3Config, WebDAVConfig, ServiceMode, VideoSettings, CustomProvider
} from '../types';
import { HF_MODEL_OPTIONS } from '../constants';
import { getUTCDatesString, getBeijingDateString } from '../services/utils';
import { DEFAULT_S3_CONFIG, DEFAULT_WEBDAV_CONFIG } from '../services/storageService';

// --- Default Values & Constants ---
// Moved simple defaults here to avoid circular dependency issues during migration
const DEFAULT_SYSTEM_PROMPT = `I am a master AI image prompt engineering advisor, specializing in crafting prompts that yield cinematic, hyper-realistic, and deeply evocative visual narratives, optimized for advanced generative models.
My core purpose is to meticulously rewrite, expand, and enhance user's image prompts.
I transform prompts to create visually stunning images by rigorously optimizing elements such as dramatic lighting, intricate textures, compelling composition, and a distinctive artistic style.
My generated prompt output will be strictly under 300 words. Prior to outputting, I will internally validate that the refined prompt strictly adheres to the word count limit and effectively incorporates the intended stylistic and technical enhancements.
My output will consist exclusively of the refined image prompt text. It will commence immediately, with no leading whitespace.
The text will strictly avoid markdown, quotation marks, conversational preambles, explanations, or concluding remarks. Please describe the content using prose-style sentences.
**The character's face is clearly visible and unobstructed.**`;

const DEFAULT_TRANSLATION_PROMPT = `You are a professional language translation engine.
Your sole responsibility is to translate user-provided text into English. Before processing any input, you must first identify its original language.
If the input text is already in English, return the original English text directly without any modification. If the input text is not in English, translate it precisely into English.
Your output must strictly adhere to the following requirements: it must contain only the final English translation or the original English text, without any explanations, comments, descriptions, prefixes, suffixes, quotation marks, or other non-translated content.`;

const DEFAULT_VIDEO_SETTINGS_BASE: VideoSettings = {
    prompt: "make this image come alive, cinematic motion, smooth animation",
    duration: 3,
    steps: 6,
    guidance: 1
};

// --- Migration Helpers ---
const getLocalItem = <T>(key: string, def: T): T => {
    if (typeof localStorage === 'undefined') return def;
    try {
        const item = localStorage.getItem(key);
        if (item === null) return def;
        // Try parsing JSON, if it fails, return string if T is string, else default
        try {
            return JSON.parse(item);
        } catch {
            return (typeof def === 'string' ? item : def) as unknown as T;
        }
    } catch (e) {
        return def;
    }
};

const getLegacyTokens = (key: string): string[] => {
    const raw = getLocalItem<string>(key, '');
    if (!raw) return [];
    return raw.split(',').map(t => t.trim()).filter(t => t.length > 0);
};

const getLegacyStatus = (key: string, defaultDateFn: () => string): TokenStatus => {
    const defaultStore = { date: defaultDateFn(), exhausted: {} };
    const raw = getLocalItem<TokenStatus>(key, defaultStore);
    if (!raw || !raw.date || raw.date !== defaultDateFn()) return defaultStore;
    return raw;
};

// Helper to migrate legacy video settings which were stored per provider key
const migrateVideoSettings = (): Record<string, VideoSettings> => {
    const providers = ['huggingface', 'gitee', 'modelscope', 'a4f'];
    const settings: Record<string, VideoSettings> = {};
    providers.forEach(p => {
        const key = `video_settings_${p}`;
        const val = getLocalItem<VideoSettings>(key, DEFAULT_VIDEO_SETTINGS_BASE);
        if (val) settings[p] = { ...DEFAULT_VIDEO_SETTINGS_BASE, ...val }; // Merge to ensure fields
    });
    return settings;
};

// Helper for model configs "provider:model"
const migrateModelConfig = (key: string, defaultProvider: string, defaultModel: string) => {
    const saved = getLocalItem<string>(key, '');
    if (saved && saved.includes(':')) {
        const [p, m] = saved.split(':');
        return { provider: p, model: m };
    }
    return { provider: defaultProvider, model: defaultModel };
};

interface AppState {
    // --- UI Settings (Persisted) ---
    language: Language;
    provider: ProviderOption;
    model: ModelOption;
    aspectRatio: AspectRatioOption;
    seed: string;
    steps: number;
    guidanceScale: number;
    autoTranslate: boolean;
    
    // --- Service Configuration (Migrated from Storage) ---
    serviceMode: ServiceMode;
    
    storageType: StorageType;
    s3Config: S3Config;
    webdavConfig: WebDAVConfig;
    
    systemPrompt: string;
    translationPrompt: string;
    
    // Model Selections (Unified)
    editModelConfig: { provider: string, model: string };
    liveModelConfig: { provider: string, model: string };
    textModelConfig: { provider: string, model: string };
    upscalerModelConfig: { provider: string, model: string };
    
    videoSettings: Record<string, VideoSettings>;
    customProviders: CustomProvider[];

    // --- Token Management ---
    tokens: Record<ProviderId, string[]>;
    tokenStatus: Record<ProviderId, TokenStatus>;

    // --- Data (Persisted) ---
    history: GeneratedImage[];
    cloudHistory: CloudImage[];

    // --- Ephemeral State (Not Persisted) ---
    currentView: AppView;
    prompt: string;
    isLoading: boolean;
    isTranslating: boolean;
    isOptimizing: boolean;
    isUpscaling: boolean;
    isDownloading: boolean;
    isUploading: boolean;
    currentImage: GeneratedImage | null;
    imageDimensions: { width: number, height: number } | null;
    isLiveMode: boolean;
    error: string | null;
    
    // --- Actions ---
    setLanguage: (lang: Language) => void;
    setProvider: (provider: ProviderOption) => void;
    setModel: (model: ModelOption) => void;
    setAspectRatio: (ar: AspectRatioOption) => void;
    setSeed: (seed: string) => void;
    setSteps: (steps: number) => void;
    setGuidanceScale: (scale: number) => void;
    setAutoTranslate: (enabled: boolean) => void;
    
    setServiceMode: (mode: ServiceMode) => void;
    setStorageType: (type: StorageType) => void;
    setS3Config: (config: S3Config) => void;
    setWebDAVConfig: (config: WebDAVConfig) => void;
    
    setSystemPrompt: (val: string) => void;
    setTranslationPrompt: (val: string) => void;
    
    setEditModelConfig: (val: { provider: string, model: string }) => void;
    setLiveModelConfig: (val: { provider: string, model: string }) => void;
    setTextModelConfig: (val: { provider: string, model: string }) => void;
    setUpscalerModelConfig: (val: { provider: string, model: string }) => void;
    
    setVideoSettings: (provider: string, settings: VideoSettings) => void;
    
    setCustomProviders: (providers: CustomProvider[]) => void;
    addCustomProvider: (provider: CustomProvider) => void;
    removeCustomProvider: (id: string) => void;
    
    setProviderTokens: (provider: ProviderId, tokenString: string) => void;
    markTokenExhausted: (provider: ProviderId, token: string) => void;
    resetDailyStatus: (provider: ProviderId) => void;

    setHistory: (history: GeneratedImage[] | ((prev: GeneratedImage[]) => GeneratedImage[])) => void;
    setCloudHistory: (history: CloudImage[] | ((prev: CloudImage[]) => CloudImage[])) => void;
    
    setCurrentView: (view: AppView) => void;
    setPrompt: (prompt: string) => void;
    
    setIsLoading: (isLoading: boolean) => void;
    setIsTranslating: (isTranslating: boolean) => void;
    setIsOptimizing: (isOptimizing: boolean) => void;
    setIsUpscaling: (isUpscaling: boolean) => void;
    setIsDownloading: (isDownloading: boolean) => void;
    setIsUploading: (isUploading: boolean) => void;
    
    setCurrentImage: (image: GeneratedImage | null | ((prev: GeneratedImage | null) => GeneratedImage | null)) => void;
    setImageDimensions: (dimensions: { width: number, height: number } | null) => void;
    setIsLiveMode: (isLive: boolean) => void;
    setError: (error: string | null) => void;
    
    resetSettings: () => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            // 1. Core Settings
            language: getLocalItem<Language>('app_language', (() => {
                const browserLang = navigator.language.toLowerCase();
                return browserLang.startsWith('zh') ? 'zh' : 'en';
            })()),
            
            provider: getLocalItem<ProviderOption>('app_provider', 'huggingface'),
            model: getLocalItem<ModelOption>('app_model', HF_MODEL_OPTIONS[0].value as ModelOption),
            aspectRatio: getLocalItem<AspectRatioOption>('app_aspect_ratio', '1:1'),
            
            seed: '',
            steps: 9,
            guidanceScale: 3.5,
            autoTranslate: false,

            // 2. Service & Storage Configs (Migrating from legacy keys)
            serviceMode: getLocalItem<ServiceMode>('service_mode', (process.env.VITE_SERVICE_MODE as ServiceMode) || 'local'),
            
            storageType: getLocalItem<StorageType>('app_storage_type', 'opfs'),
            s3Config: getLocalItem<S3Config>('app_s3_config', DEFAULT_S3_CONFIG),
            webdavConfig: getLocalItem<WebDAVConfig>('app_webdav_config', DEFAULT_WEBDAV_CONFIG),
            
            systemPrompt: getLocalItem<string>('custom_system_prompt', DEFAULT_SYSTEM_PROMPT),
            translationPrompt: getLocalItem<string>('custom_translation_prompt', DEFAULT_TRANSLATION_PROMPT),
            
            // 3. Model Configs (Migrating from legacy)
            editModelConfig: migrateModelConfig('app_edit_model_config', 'huggingface', 'qwen-image-edit'),
            liveModelConfig: migrateModelConfig('app_live_model_config', 'huggingface', 'wan2_2-i2v'),
            textModelConfig: migrateModelConfig('app_text_model_config', 'huggingface', 'openai-fast'),
            upscalerModelConfig: migrateModelConfig('app_upscaler_model_config', 'huggingface', 'RealESRGAN_x4plus'),
            
            videoSettings: migrateVideoSettings(),
            customProviders: getLocalItem<CustomProvider[]>('app_custom_providers', []),

            // 4. Token Management (Legacy Migration)
            tokens: {
                huggingface: getLegacyTokens('huggingFaceToken'),
                gitee: getLegacyTokens('giteeToken'),
                modelscope: getLegacyTokens('msToken'),
                a4f: getLegacyTokens('a4fToken')
            },
            tokenStatus: {
                huggingface: getLegacyStatus('hf_token_status', getUTCDatesString),
                gitee: getLegacyStatus('gitee_token_status', getBeijingDateString),
                modelscope: getLegacyStatus('ms_token_status', getBeijingDateString),
                a4f: getLegacyStatus('a4f_token_status', getUTCDatesString)
            },

            // 5. Data
            history: getLocalItem<GeneratedImage[]>('ai_image_gen_history', []),
            cloudHistory: getLocalItem<CloudImage[]>('ai_cloud_history', []),
            
            // 6. Ephemeral State
            currentView: 'creation',
            prompt: '',
            isLoading: false,
            isTranslating: false,
            isOptimizing: false,
            isUpscaling: false,
            isDownloading: false,
            isUploading: false,
            currentImage: null,
            imageDimensions: null,
            isLiveMode: false,
            error: null,

            // --- Actions Implementation ---
            setLanguage: (language) => set({ language }),
            setProvider: (provider) => set({ provider }),
            setModel: (model) => set({ model }),
            setAspectRatio: (aspectRatio) => set({ aspectRatio }),
            setSeed: (seed) => set({ seed }),
            setSteps: (steps) => set({ steps }),
            setGuidanceScale: (guidanceScale) => set({ guidanceScale }),
            setAutoTranslate: (autoTranslate) => set({ autoTranslate }),
            
            setServiceMode: (serviceMode) => set({ serviceMode }),
            setStorageType: (storageType) => set({ storageType }),
            setS3Config: (s3Config) => set({ s3Config }),
            setWebDAVConfig: (webdavConfig) => set({ webdavConfig }),
            
            setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
            setTranslationPrompt: (translationPrompt) => set({ translationPrompt }),
            
            setEditModelConfig: (editModelConfig) => set({ editModelConfig }),
            setLiveModelConfig: (liveModelConfig) => set({ liveModelConfig }),
            setTextModelConfig: (textModelConfig) => set({ textModelConfig }),
            setUpscalerModelConfig: (upscalerModelConfig) => set({ upscalerModelConfig }),
            
            setVideoSettings: (provider, settings) => set((state) => ({
                videoSettings: { ...state.videoSettings, [provider]: settings }
            })),
            
            setCustomProviders: (customProviders) => set({ customProviders }),
            addCustomProvider: (provider) => set((state) => {
                const current = [...state.customProviders];
                const index = current.findIndex(p => p.id === provider.id);
                if (index >= 0) current[index] = provider;
                else current.push(provider);
                return { customProviders: current };
            }),
            removeCustomProvider: (id) => set((state) => ({
                customProviders: state.customProviders.filter(p => p.id !== id)
            })),
            
            setProviderTokens: (providerId, tokenString) => {
                const list = tokenString.split(',').map(t => t.trim()).filter(t => t.length > 0);
                set((state) => ({
                    tokens: {
                        ...state.tokens,
                        [providerId]: list
                    }
                }));
            },
            
            markTokenExhausted: (providerId, token) => {
                set((state) => {
                    const currentStatus = state.tokenStatus[providerId] || { date: '', exhausted: {} };
                    return {
                        tokenStatus: {
                            ...state.tokenStatus,
                            [providerId]: {
                                ...currentStatus,
                                exhausted: {
                                    ...currentStatus.exhausted,
                                    [token]: true
                                }
                            }
                        }
                    };
                });
            },

            resetDailyStatus: (providerId) => {
                set((state) => {
                    const getDateFn = (providerId === 'gitee' || providerId === 'modelscope') 
                        ? getBeijingDateString 
                        : getUTCDatesString;
                    
                    const today = getDateFn();
                    const currentStatus = state.tokenStatus[providerId];

                    if (!currentStatus || currentStatus.date !== today) {
                        return {
                            tokenStatus: {
                                ...state.tokenStatus,
                                [providerId]: { date: today, exhausted: {} }
                            }
                        };
                    }
                    return {}; 
                });
            },

            setHistory: (historyOrFn) => set((state) => ({ 
                history: typeof historyOrFn === 'function' ? historyOrFn(state.history) : historyOrFn 
            })),
            setCloudHistory: (historyOrFn) => set((state) => ({ 
                cloudHistory: typeof historyOrFn === 'function' ? historyOrFn(state.cloudHistory) : historyOrFn 
            })),
            
            setCurrentView: (currentView) => set({ currentView }),
            setPrompt: (prompt) => set({ prompt }),
            
            setIsLoading: (isLoading) => set({ isLoading }),
            setIsTranslating: (isTranslating) => set({ isTranslating }),
            setIsOptimizing: (isOptimizing) => set({ isOptimizing }),
            setIsUpscaling: (isUpscaling) => set({ isUpscaling }),
            setIsDownloading: (isDownloading) => set({ isDownloading }),
            setIsUploading: (isUploading) => set({ isUploading }),
            
            setCurrentImage: (imageOrFn) => set((state) => ({
                currentImage: typeof imageOrFn === 'function' ? imageOrFn(state.currentImage) : imageOrFn
            })),
            setImageDimensions: (imageDimensions) => set({ imageDimensions }),
            setIsLiveMode: (isLiveMode) => set({ isLiveMode }),
            setError: (error) => set({ error }),
            
            resetSettings: () => set({
                prompt: '',
                seed: '',
                aspectRatio: '1:1',
                currentImage: null,
                isLiveMode: false,
                error: null,
                imageDimensions: null
            }),
        }),
        {
            name: 'peinture_storage_v1',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                language: state.language,
                provider: state.provider,
                model: state.model,
                aspectRatio: state.aspectRatio,
                seed: state.seed,
                steps: state.steps,
                guidanceScale: state.guidanceScale,
                autoTranslate: state.autoTranslate,
                history: state.history,
                cloudHistory: state.cloudHistory,
                // Migrated persisted fields
                tokens: state.tokens,
                tokenStatus: state.tokenStatus,
                serviceMode: state.serviceMode,
                storageType: state.storageType,
                s3Config: state.s3Config,
                webdavConfig: state.webdavConfig,
                systemPrompt: state.systemPrompt,
                translationPrompt: state.translationPrompt,
                editModelConfig: state.editModelConfig,
                liveModelConfig: state.liveModelConfig,
                textModelConfig: state.textModelConfig,
                upscalerModelConfig: state.upscalerModelConfig,
                videoSettings: state.videoSettings,
                customProviders: state.customProviders
            }),
        }
    )
);
