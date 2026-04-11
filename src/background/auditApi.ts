import type {
  AuditAnalyzeResponse,
  AuditCodePatches,
  AuditIssue,
  AuditRequestPayload,
  AuditSummary,
} from "../types/audit";
import { WCAG_REFERENCE_MAP } from "../types/audit";
import { DEFAULT_GEMINI_AUDIT_MODEL, DEFAULT_GEMINI_IMAGE_MODEL, getAuditSettings, isDemoApiBase } from "./auditSettings";
import { analyzeAuditWithGemini } from "./geminiAudit";
import { generateAuditMockupImage } from "./geminiImageMockup";

function analyzeUrl(base: string): string {
  const b = base.replace(/\/+$/, "");
  if (b.endsWith("/analyze")) return b;
  return `${b}/analyze`;
}

export type ImageMockupPlanItem = { issueId: string; generationPrompt: string };

function extractImageMockupPlan(parsed: unknown): ImageMockupPlanItem[] {
  const d = parsed as { imageMockupPlan?: unknown };
  if (!Array.isArray(d.imageMockupPlan)) return [];
  return d.imageMockupPlan
    .filter((p): p is ImageMockupPlanItem => {
      if (!p || typeof p !== "object") return false;
      const o = p as Record<string, unknown>;
      return typeof o.issueId === "string" && typeof o.generationPrompt === "string";
    })
    .slice(0, 2);
}

function pickStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

function pickStrArr(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return out.length ? out : undefined;
}

function pickPatches(v: unknown): AuditCodePatches | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const css = pickStr(o.css);
  const html = pickStr(o.html);
  const aria = pickStr(o.aria);
  if (!css && !html && !aria) return undefined;
  return { css, html, aria };
}

function mockFromPayload(payload: AuditRequestPayload): AuditAnalyzeResponse {
  const nodes = payload.dom.nodes.filter((n) => n.visible);
  const pick = (i: number) => nodes[i];

  const issues: AuditIssue[] = [];
  const n0 = pick(0);
  if (n0) {
    issues.push({
      id: "mock-1",
      selector: n0.selector,
      category: "accessibility",
      type: "contrast",
      severity: "major",
      description: "Computed foreground/background may not meet WCAG AA for normal text (4.5:1).",
      impactedUsers: ["Low vision", "Users in bright sunlight"],
      suggestedFix:
        "Target ≥4.5:1 for normal text (≥3:1 for large/bold). Example:\n.btn-primary {\n  color: #0a0a0a;\n  background-color: #f5f5f5;\n}\n@media (prefers-contrast: more) { ... }",
      wcagReference: WCAG_REFERENCE_MAP.contrast,
      boundingBox: n0.box,
      advancedRationale:
        "Use computed colors from snapshot vs white background; verify with a contrast checker on final brand tokens. AA is the legal baseline for many orgs; AAA body text is often impractical for brand colors.",
      implementationChecklist: [
        "Define design tokens for text/bg pairs with measured ratios.",
        "Add focus-visible outline that meets non-text contrast (3:1).",
        "Snapshot Percy/Chromatic or Storybook a11y addon for regressions.",
      ],
      codePatches: {
        css: `.btn { color: #0a0a0a; background-color: #fafafa; }\n.btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }`,
      },
    });
  }
  const n1 = pick(1);
  if (n1) {
    issues.push({
      id: "mock-2",
      selector: n1.selector,
      category: "ux",
      type: "tap_target",
      severity: "minor",
      description: "Interactive target likely under recommended minimum for dense touch layouts.",
      impactedUsers: ["Motor impairments", "Touch users"],
      suggestedFix:
        "Enforce min 44×44 CSS px hit area (WCAG 2.5.8) or equivalent padding + min-width/min-height; avoid overlapping touch targets.",
      wcagReference: WCAG_REFERENCE_MAP.targetSize,
      boundingBox: n1.box,
      advancedRationale:
        "Client rect from snapshot vs viewport scale; DPR does not change CSS px requirements. Consider increasing spacing between adjacent controls.",
      implementationChecklist: [
        "Audit all interactive nodes in this cluster with box model overlay.",
        "Add pointer-events and z-index review if overlays steal taps.",
      ],
      codePatches: {
        css: `a.nav-link {\n  min-width: 44px;\n  min-height: 44px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n}`,
      },
    });
  }
  const n2 = pick(2);
  if (n2 && n2.tag === "img") {
    issues.push({
      id: "mock-3",
      selector: n2.selector,
      category: "accessibility",
      type: "alt_text",
      severity: "suggestion",
      description: "Verify whether image is decorative or informative; alt must match role.",
      impactedUsers: ["Screen reader users"],
      suggestedFix:
        'Decorative: alt="" and aria-hidden where appropriate. Informative: concise purpose-focused alt; avoid filename soup.',
      wcagReference: WCAG_REFERENCE_MAP.nameRoleValue,
      boundingBox: n2.box,
      advancedRationale:
        "Screen readers announce name from alt or aria-label; wrong role breaks comprehension for linked images.",
      implementationChecklist: [
        "If inside <a>, ensure alt describes destination, not only pixels.",
        "Add figcaption if complex chart (with extended description pattern).",
      ],
      codePatches: {
        html: `<!-- decorative -->\n<img src="..." alt="" role="presentation" />\n\n<!-- informative -->\n<img src="..." alt="Quarterly revenue up 12% vs prior year" />`,
      },
    });
  }

  const summary: AuditSummary = {
    total: issues.length,
    critical: issues.filter((i) => i.severity === "critical").length,
    major: issues.filter((i) => i.severity === "major").length,
    minor: issues.filter((i) => i.severity === "minor").length,
    suggestion: issues.filter((i) => i.severity === "suggestion").length,
  };

  return {
    summary,
    issues,
    notes:
      "Demo mode — sample technical findings. Add a Gemini API key in FairFrame settings for full AI + optional mockups.",
  };
}

type BoundingBoxLike = { x: number; y: number; width: number; height: number };

export function normalizeResponse(data: unknown): AuditAnalyzeResponse {
  const d = data as Partial<AuditAnalyzeResponse>;
  const issues = Array.isArray(d.issues) ? d.issues : [];
  const s = d.summary;
  const summary: AuditSummary = {
    total: typeof s?.total === "number" ? s.total : issues.length,
    critical: typeof s?.critical === "number" ? s.critical : 0,
    major: typeof s?.major === "number" ? s.major : 0,
    minor: typeof s?.minor === "number" ? s.minor : 0,
    suggestion: typeof s?.suggestion === "number" ? s.suggestion : 0,
  };
  const mapped: AuditIssue[] = issues.map((raw, idx) => {
    const i = raw as Record<string, unknown>;
    return {
      id: String(i.id || `issue-${idx + 1}`),
      selector: String(i.selector || ""),
      category:
        i.category === "seo" || i.category === "accessibility" || i.category === "ux" ? i.category : "ux",
      type: String(i.type || "general"),
      severity:
        i.severity === "critical" || i.severity === "major" || i.severity === "minor" || i.severity === "suggestion"
          ? i.severity
          : "suggestion",
      description: String(i.description || ""),
      impactedUsers: Array.isArray(i.impactedUsers) ? i.impactedUsers.map(String) : [],
      suggestedFix: String(i.suggestedFix || ""),
      wcagReference: pickStr(i.wcagReference),
      boundingBox:
        i.boundingBox &&
        typeof i.boundingBox === "object" &&
        typeof (i.boundingBox as BoundingBoxLike).x === "number" &&
        typeof (i.boundingBox as BoundingBoxLike).y === "number" &&
        typeof (i.boundingBox as BoundingBoxLike).width === "number" &&
        typeof (i.boundingBox as BoundingBoxLike).height === "number"
          ? (i.boundingBox as AuditIssue["boundingBox"])
          : undefined,
      advancedRationale: pickStr(i.advancedRationale),
      implementationChecklist: pickStrArr(i.implementationChecklist),
      codePatches: pickPatches(i.codePatches),
    };
  });

  const recount = {
    total: mapped.length,
    critical: mapped.filter((i) => i.severity === "critical").length,
    major: mapped.filter((i) => i.severity === "major").length,
    minor: mapped.filter((i) => i.severity === "minor").length,
    suggestion: mapped.filter((i) => i.severity === "suggestion").length,
  };

  const summaryAligned: AuditSummary =
    typeof s?.total === "number" && s.total === mapped.length ? summary : { ...recount };

  return {
    summary: summaryAligned,
    issues: mapped,
    notes: typeof d.notes === "string" ? d.notes : undefined,
  };
}

function issueContextForImage(issue: AuditIssue): string {
  return [
    `id: ${issue.id}`,
    `selector: ${issue.selector}`,
    `severity: ${issue.severity}`,
    `type: ${issue.type}`,
    `description: ${issue.description}`,
    `suggestedFix: ${issue.suggestedFix}`,
    issue.advancedRationale ? `advancedRationale: ${issue.advancedRationale}` : "",
    issue.wcagReference ? `wcag: ${issue.wcagReference}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function attachGeminiMockups(
  issues: AuditIssue[],
  plan: ImageMockupPlanItem[],
  opts: {
    apiKey: string;
    imageModel: string;
    viewportJpeg: string | null;
  },
): Promise<void> {
  for (const item of plan) {
    const issue = issues.find((x) => x.id === item.issueId);
    if (!issue) continue;
    try {
      const { imageBase64, mime, caption } = await generateAuditMockupImage({
        apiKey: opts.apiKey,
        model: opts.imageModel,
        viewportJpegBase64: opts.viewportJpeg,
        issueContext: issueContextForImage(issue),
        generationPrompt: item.generationPrompt,
      });
      if (imageBase64) {
        issue.mockupImageBase64 = imageBase64;
        issue.mockupImageMime = mime;
        issue.mockupCaption = caption || issue.mockupCaption;
      }
    } catch {
      /* optional path — skip mockup on API or safety errors */
    }
  }
}

export async function postAuditAnalyze(payload: AuditRequestPayload): Promise<AuditAnalyzeResponse> {
  const settings = await getAuditSettings();
  const { apiBaseUrl, apiKey, geminiApiKey, geminiModel, geminiImageModel, geminiMockupsEnabled } = settings;

  if (!isDemoApiBase(apiBaseUrl)) {
    const url = analyzeUrl(apiBaseUrl);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Review server ${res.status}: ${t.slice(0, 200) || res.statusText}`);
    }
    const json = await res.json();
    return normalizeResponse(json);
  }

  if (geminiApiKey) {
    const model = geminiModel.trim() || DEFAULT_GEMINI_AUDIT_MODEL;
    const { parsed, notesExtra } = await analyzeAuditWithGemini({
      apiKey: geminiApiKey,
      model,
      payload,
    });
    const plan = extractImageMockupPlan(parsed);
    const out = normalizeResponse(parsed);
    out.notes = [out.notes, notesExtra].filter(Boolean).join(" — ");

    if (geminiMockupsEnabled && plan.length > 0) {
      const imgModel = geminiImageModel.trim() || DEFAULT_GEMINI_IMAGE_MODEL;
      await attachGeminiMockups(out.issues, plan, {
        apiKey: geminiApiKey,
        imageModel: imgModel,
        viewportJpeg: payload.screenshotViewportJpegBase64,
      });
      const mockNote = `Mockups: ${imgModel} (up to ${plan.length} image${plan.length > 1 ? "s" : ""}).`;
      out.notes = [out.notes, mockNote].filter(Boolean).join(" — ");
    }

    return out;
  }

  return mockFromPayload(payload);
}
