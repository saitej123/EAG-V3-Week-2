import { useCallback, useEffect, useState } from "react";
import {
  ClipboardList,
  Download,
  Eye,
  EyeOff,
  Loader2,
  ScanLine,
  Settings,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import type { AuditSessionStored, ViewportProfile } from "../types/audit";
import { auditToJson, auditToMarkdown } from "../lib/auditExport";
import { cn } from "../lib/utils";
import { sendMessage } from "./messaging";

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function severityClass(s: string): string {
  switch (s) {
    case "critical":
      return "border-red-600/80 text-red-700 dark:border-red-500/60 dark:text-red-300";
    case "major":
      return "border-orange-600/80 text-orange-800 dark:border-orange-500/50 dark:text-orange-200";
    case "minor":
      return "border-amber-600/70 text-amber-900 dark:border-amber-500/45 dark:text-amber-200";
    default:
      return "border-blue-600/70 text-blue-900 dark:border-blue-500/45 dark:text-blue-200";
  }
}

/** Plain-language labels for non-technical readers. */
function friendlySeverity(s: string): string {
  switch (s) {
    case "critical":
      return "Urgent";
    case "major":
      return "Important";
    case "minor":
      return "Small fix";
    case "suggestion":
      return "Idea";
    default:
      return s;
  }
}

function friendlyCategory(c: string): string {
  switch (c) {
    case "accessibility":
      return "Easier for everyone";
    case "ux":
      return "Layout & clarity";
    case "seo":
      return "Findability";
    default:
      return c;
  }
}

export default function App() {
  const [viewport, setViewport] = useState<ViewportProfile>("desktop");
  const [session, setSession] = useState<AuditSessionStored | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewSource, setReviewSource] = useState<"gemini" | "custom" | "demo" | null>(null);

  const refresh = useCallback(async () => {
    const res = await sendMessage<{
      ok?: boolean;
      session?: AuditSessionStored;
      overlayVisible?: boolean;
    }>({ type: "AUDIT_LOAD_LAST" });
    if (res.session) setSession(res.session);
    if (typeof res.overlayVisible === "boolean") setOverlayVisible(res.overlayVisible);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadPanelSettings = useCallback(() => {
    void sendMessage<{
      ok?: boolean;
      settings?: { defaultViewport: ViewportProfile };
      reviewSource?: "gemini" | "custom" | "demo";
    }>({
      type: "AUDIT_GET_SETTINGS",
    }).then((r) => {
      if (r.settings?.defaultViewport) setViewport(r.settings.defaultViewport);
      if (r.reviewSource) setReviewSource(r.reviewSource);
    });
  }, []);

  useEffect(() => {
    loadPanelSettings();
  }, [loadPanelSettings]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") loadPanelSettings();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadPanelSettings]);

  const runAudit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await sendMessage<{ ok: boolean; session?: AuditSessionStored; error?: string }>({
        type: "AUDIT_RUN",
        viewportProfile: viewport,
      });
      if (!res.ok) throw new Error(res.error || "Something went wrong—try again or refresh the page.");
      if (res.session) setSession(res.session);
      setOverlayVisible(true);
      setReportOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleOverlay = async () => {
    setError(null);
    try {
      const res = await sendMessage<{ ok: boolean; visible?: boolean; error?: string }>({
        type: "AUDIT_TOGGLE_OVERLAY",
      });
      if (!res.ok) throw new Error(res.error || "Could not show or hide highlights.");
      if (typeof res.visible === "boolean") setOverlayVisible(res.visible);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const openOptions = () => {
    void chrome.runtime.openOptionsPage();
  };

  const summary = session?.response.summary;

  const reviewHint =
    reviewSource === "custom"
      ? "Checks go to your review server."
      : reviewSource === "gemini"
        ? "Checks use Google Gemini (screenshot + DOM) through FairFrame."
        : reviewSource === "demo"
          ? "Demo mode — add a Gemini key in FairFrame settings for full AI, or point at your own review API."
          : null;

  return (
    <div className="relative min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-lg items-start justify-between gap-3 p-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-500">
              FairFrame
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">Reframe your UI—inclusive by design</h1>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              With Gemini: technical rationale, implementation checklists, code-oriented patches, and optional generated
              mockups—plus on-page highlights.
            </p>
            {reviewHint ? (
              <p className="mt-2 rounded-md border border-zinc-200 bg-zinc-100/80 px-2 py-1.5 text-[11px] text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                {reviewHint}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9 shrink-0 px-2.5"
            onClick={openOptions}
            aria-label="Open FairFrame settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pb-10">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
            {error}
          </div>
        ) : null}

        <Card>
          <CardHeader className="pb-2">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-500">Screen size (for the report)</div>
            <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Pick how this check should be labeled. For a truer phone or tablet view, narrow or widen the browser
              window before you run the check.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex rounded-lg border border-zinc-200 bg-zinc-100/50 p-0.5 dark:border-zinc-800 dark:bg-zinc-900/50">
              {(["desktop", "tablet", "mobile"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  disabled={busy}
                  onClick={() => setViewport(v)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-2 text-xs font-medium capitalize transition-colors",
                    viewport === v
                      ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2">
          <Button type="button" className="w-full" disabled={busy} onClick={() => void runAudit()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            Run check
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!session}
              onClick={() => setReportOpen((o) => !o)}
            >
              <ClipboardList className="h-4 w-4" />
              {reportOpen ? "Hide report" : "View report"}
            </Button>
            <Button type="button" variant="outline" disabled={!session} onClick={() => void toggleOverlay()}>
              {overlayVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {overlayVisible ? "Hide overlay" : "Show overlay"}
            </Button>
          </div>
        </div>

        {summary ? (
          <Card>
            <CardHeader className="pb-2">
              <div className="text-sm font-medium">Last check</div>
              <p className="truncate text-xs text-zinc-500" title={session?.meta.url}>
                {session?.meta.title || session?.meta.url}
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 pt-0">
              <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium dark:border-zinc-800 dark:bg-zinc-900">
                Total {summary.total}
              </span>
              <span
                className={cn(
                  "rounded-full border bg-white px-2.5 py-1 text-[11px] font-medium dark:bg-zinc-900",
                  severityClass("critical"),
                )}
              >
                Urgent {summary.critical}
              </span>
              <span
                className={cn(
                  "rounded-full border bg-white px-2.5 py-1 text-[11px] font-medium dark:bg-zinc-900",
                  severityClass("major"),
                )}
              >
                Important {summary.major}
              </span>
              <span
                className={cn(
                  "rounded-full border bg-white px-2.5 py-1 text-[11px] font-medium dark:bg-zinc-900",
                  severityClass("minor"),
                )}
              >
                Small fixes {summary.minor}
              </span>
              <span
                className={cn(
                  "rounded-full border bg-white px-2.5 py-1 text-[11px] font-medium dark:bg-zinc-900",
                  severityClass("suggestion"),
                )}
              >
                Suggestions {summary.suggestion}
              </span>
            </CardContent>
          </Card>
        ) : (
          <p className="text-center text-xs text-zinc-500 dark:text-zinc-500">
            No check yet — click a normal website tab, then tap <strong>Run check</strong>.
          </p>
        )}

        {session && reportOpen ? (
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
              <div className="text-sm font-medium">What we noticed</div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => downloadText("fairframe-report.md", auditToMarkdown(session), "text/markdown")}
                >
                  <Download className="h-3.5 w-3.5" />
                  Save as notes (.md)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => downloadText("fairframe-report.json", auditToJson(session), "application/json")}
                >
                  <Download className="h-3.5 w-3.5" />
                  Save as data (.json)
                </Button>
              </div>
            </CardHeader>
            <CardContent className="max-h-[min(52vh,420px)] space-y-3 overflow-y-auto pt-0">
              {session.response.notes ? (
                <p className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                  {session.response.notes}
                </p>
              ) : null}
              {session.response.issues.map((issue) => (
                <div
                  key={issue.id}
                  className={cn(
                    "rounded-lg border bg-white p-3 text-xs dark:bg-zinc-950",
                    severityClass(issue.severity),
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold uppercase tracking-wide">{friendlySeverity(issue.severity)}</span>
                    <span className="text-zinc-500 dark:text-zinc-500">{friendlyCategory(issue.category)}</span>
                    <span className="font-mono text-[10px] text-zinc-500">{issue.type}</span>
                  </div>
                  <p className="mt-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Summary</p>
                  <p className="mt-0.5 leading-relaxed text-zinc-800 dark:text-zinc-200">{issue.description}</p>
                  {issue.wcagReference ? (
                    <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">{issue.wcagReference}</p>
                  ) : null}
                  {issue.advancedRationale ? (
                    <details className="mt-2 rounded-md border border-zinc-200 dark:border-zinc-800">
                      <summary className="cursor-pointer px-2 py-1.5 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                        Technical rationale
                      </summary>
                      <p className="border-t border-zinc-200 px-2 py-2 text-[11px] leading-relaxed text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
                        {issue.advancedRationale}
                      </p>
                    </details>
                  ) : null}
                  {issue.implementationChecklist?.length ? (
                    <div className="mt-2">
                      <p className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">Implementation checklist</p>
                      <ul className="mt-1 list-inside list-disc text-[11px] text-zinc-700 dark:text-zinc-300">
                        {issue.implementationChecklist.map((step, j) => (
                          <li key={j}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <p className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">Impacted: </span>
                    {issue.impactedUsers.join(", ")}
                  </p>
                  <p className="mt-2 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">Primary fix</p>
                  <pre className="mt-1 max-h-36 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-2 font-mono text-[10px] leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                    {issue.suggestedFix}
                  </pre>
                  {issue.codePatches?.css ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                        CSS patch
                      </summary>
                      <pre className="mt-1 max-h-32 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-2 font-mono text-[10px] dark:border-zinc-800 dark:bg-zinc-900">
                        {issue.codePatches.css}
                      </pre>
                    </details>
                  ) : null}
                  {issue.codePatches?.html ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                        HTML patch
                      </summary>
                      <pre className="mt-1 max-h-32 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-2 font-mono text-[10px] dark:border-zinc-800 dark:bg-zinc-900">
                        {issue.codePatches.html}
                      </pre>
                    </details>
                  ) : null}
                  {issue.codePatches?.aria ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                        ARIA patch
                      </summary>
                      <pre className="mt-1 max-h-32 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-2 font-mono text-[10px] dark:border-zinc-800 dark:bg-zinc-900">
                        {issue.codePatches.aria}
                      </pre>
                    </details>
                  ) : null}
                  {issue.mockupImageBase64 ? (
                    <div className="mt-3">
                      <p className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">Generated mockup</p>
                      {issue.mockupCaption ? (
                        <p className="mt-1 text-[10px] text-zinc-600 dark:text-zinc-400">{issue.mockupCaption}</p>
                      ) : null}
                      <img
                        alt={issue.mockupCaption || "Audit mockup"}
                        className="mt-2 max-h-48 w-full rounded-md border border-zinc-200 object-contain dark:border-zinc-800"
                        src={`data:${issue.mockupImageMime || "image/png"};base64,${issue.mockupImageBase64}`}
                      />
                    </div>
                  ) : null}
                  <p className="mt-2 font-mono text-[10px] text-zinc-500 break-all">{issue.selector}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <p className="text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-600">
          Optional shortcut: set <strong>Run FairFrame review</strong> in{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">chrome://extensions/shortcuts</code>. On the page,
          colors mean urgency—hover or tap a box for tips.
        </p>
      </div>
    </div>
  );
}
