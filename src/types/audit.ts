/** Viewport profile sent to the backend (actual window size is included separately). */
export type ViewportProfile = "desktop" | "tablet" | "mobile";

export type AuditSeverity = "critical" | "major" | "minor" | "suggestion";

export type BoundingBoxDoc = {
  /** Document-space coordinates (scroll included). */
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AuditDomNode = {
  selector: string;
  tag: string;
  role: string | null;
  /** Accessible name hint (aria-label, alt, associated label, or short text). */
  name: string | null;
  headingLevel: number | null;
  href: string | null;
  inputType: string | null;
  alt: string | null;
  /** Trimmed ARIA attributes (role handled separately). */
  aria: Record<string, string>;
  box: BoundingBoxDoc;
  styles: {
    color: string;
    backgroundColor: string;
    fontSize: string;
    lineHeight: string;
    width: string;
    height: string;
  };
  visible: boolean;
};

export type AuditRequestMeta = {
  url: string;
  title: string;
  viewportProfile: ViewportProfile;
  viewport: { width: number; height: number; devicePixelRatio: number };
  capturedAt: number;
};

export type AuditRequestPayload = {
  meta: AuditRequestMeta;
  /** Visible viewport JPEG (base64, no data URL prefix). */
  screenshotViewportJpegBase64: string | null;
  dom: {
    nodes: AuditDomNode[];
  };
};

export type AuditCodePatches = {
  css?: string;
  html?: string;
  aria?: string;
};

export type AuditIssue = {
  id: string;
  /** CSS selector the content script can resolve for highlights. */
  selector: string;
  category: "ux" | "accessibility" | "seo";
  type: string;
  severity: AuditSeverity;
  /** Short executive summary (still include depth below). */
  description: string;
  impactedUsers: string[];
  /** Primary fix: can mix CSS / HTML / ARIA as text. */
  suggestedFix: string;
  wcagReference?: string;
  /** If omitted, overlay tries to resolve `selector` on the page. */
  boundingBox?: BoundingBoxDoc;
  /** Senior-level: evidence, trade-offs, WCAG level (AA/AAA), regression risk. */
  advancedRationale?: string;
  /** Implementation & QA checklist for engineers. */
  implementationChecklist?: string[];
  /** Copy-paste oriented snippets. */
  codePatches?: AuditCodePatches;
  /** Optional mockup from Gemini image model (raw base64, no data-URL prefix). */
  mockupImageBase64?: string;
  /** e.g. image/png — defaults to PNG in UI if omitted. */
  mockupImageMime?: string;
  mockupCaption?: string;
};

export type AuditSummary = {
  total: number;
  critical: number;
  major: number;
  minor: number;
  suggestion: number;
};

export type AuditAnalyzeResponse = {
  summary: AuditSummary;
  issues: AuditIssue[];
  /** Optional raw model notes for debugging. */
  notes?: string;
};

export type AuditSessionResult = {
  payload: AuditRequestPayload;
  response: AuditAnalyzeResponse;
  analyzedAt: number;
};

/** Persisted without screenshot / full DOM to stay within storage quotas. */
export type AuditSessionStored = {
  meta: AuditRequestMeta;
  response: AuditAnalyzeResponse;
  analyzedAt: number;
  domNodeCount: number;
};

/** Static WCAG mappings for labels in UI / exports (extend as needed). */
export const WCAG_REFERENCE_MAP: Record<string, string> = {
  contrast: "WCAG 2.2 — 1.4.3 Contrast (Minimum)",
  contrastLarge: "WCAG 2.2 — 1.4.3 Contrast (Minimum) (large text)",
  nonTextContrast: "WCAG 2.2 — 1.4.11 Non-text Contrast",
  focusVisible: "WCAG 2.2 — 2.4.7 Focus Visible",
  nameRoleValue: "WCAG 2.2 — 4.1.2 Name, Role, Value",
  linkPurpose: "WCAG 2.2 — 2.4.4 Link Purpose (In Context)",
  labels: "WCAG 2.2 — 3.3.2 Labels or Instructions",
  targetSize: "WCAG 2.2 — 2.5.5 Target Size (Enhanced) / 2.5.8 Target Size (Minimum)",
  imagesOfText: "WCAG 2.2 — 1.4.5 Images of Text",
};
