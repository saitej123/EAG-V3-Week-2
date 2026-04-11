export type ExtensionConfigFile = {
  geminiModel?: string;
  /** "chrome" = Chrome OS/browser tts API; "gemini" = Gemini preview TTS model (separate billable call). */
  ttsEngine?: string;
  geminiTtsModel?: string;
  geminiTtsVoice?: string;
  /** Capture visible tab JPEG for VLM (default true). */
  captureViewport?: boolean;
  /** Scroll the page before capture to trigger lazy-loaded DOM (default true). */
  scrollBeforeCapture?: boolean;
  /** Max time (ms) spent scrolling to expand lazy content (default 18000). */
  scrollMaxMs?: number;
  /** Stop after ~N viewport heights of scrolling (default 48; caps endless feeds). */
  scrollMaxViewportHeights?: number;
  /** Max characters of extracted text sent to the model (default 200000). */
  maxTextChars?: number;
  /** Max number of inline images (same-origin JPEG) after scroll (default 12). */
  maxInlineImages?: number;
};

export type ResolvedExtensionConfig = {
  geminiModel: string;
  ttsEngine: "chrome" | "gemini";
  geminiTtsModel: string;
  geminiTtsVoice: string;
  captureViewport: boolean;
  scrollBeforeCapture: boolean;
  scrollMaxMs: number;
  scrollMaxViewportHeights: number;
  maxTextChars: number;
  maxInlineImages: number;
};

const DEFAULTS: ResolvedExtensionConfig = {
  geminiModel: "gemini-3.1-flash-lite-preview",
  ttsEngine: "gemini",
  geminiTtsModel: "gemini-2.5-flash-preview-tts",
  geminiTtsVoice: "Aoede",
  captureViewport: true,
  scrollBeforeCapture: true,
  scrollMaxMs: 14_000,
  scrollMaxViewportHeights: 32,
  maxTextChars: 200_000,
  maxInlineImages: 12,
};

let cache: ResolvedExtensionConfig | null = null;

function normalizeEngine(v: string | undefined): "chrome" | "gemini" {
  const x = (v || "chrome").toLowerCase().trim();
  return x === "gemini" ? "gemini" : "chrome";
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(Math.max(n, lo), hi);
}

export async function getExtensionConfig(): Promise<ResolvedExtensionConfig> {
  if (cache) return cache;
  try {
    const url = chrome.runtime.getURL("webmacaw.config.json");
    const res = await fetch(url);
    if (res.ok) {
      const j = (await res.json()) as ExtensionConfigFile;
      const num = (v: unknown, d: number) =>
        typeof v === "number" && !Number.isNaN(v) ? v : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : d;

      cache = {
        geminiModel: j.geminiModel?.trim() || DEFAULTS.geminiModel,
        ttsEngine: normalizeEngine(j.ttsEngine),
        geminiTtsModel: j.geminiTtsModel?.trim() || DEFAULTS.geminiTtsModel,
        geminiTtsVoice: j.geminiTtsVoice?.trim() || DEFAULTS.geminiTtsVoice,
        captureViewport: j.captureViewport !== false,
        scrollBeforeCapture: j.scrollBeforeCapture !== false,
        scrollMaxMs: clamp(num(j.scrollMaxMs, DEFAULTS.scrollMaxMs), 2_000, 120_000),
        scrollMaxViewportHeights: clamp(
          num(j.scrollMaxViewportHeights, DEFAULTS.scrollMaxViewportHeights),
          8,
          400,
        ),
        maxTextChars: clamp(num(j.maxTextChars, DEFAULTS.maxTextChars), 20_000, 900_000),
        maxInlineImages: clamp(num(j.maxInlineImages, DEFAULTS.maxInlineImages), 4, 32),
      };
      return cache;
    }
  } catch {
    /* fall through */
  }
  cache = { ...DEFAULTS };
  return cache;
}

export function clearExtensionConfigCache() {
  cache = null;
}
