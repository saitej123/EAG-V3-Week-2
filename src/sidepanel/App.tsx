import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Download,
  Eye,
  EyeOff,
  GitCompare,
  LayoutList,
  Loader2,
  MonitorSmartphone,
  ScanLine,
  ScrollText,
  Settings,
  SquareStack,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import type { AuditSessionStored } from "../types/audit";
import { auditToJson, auditToMarkdown } from "../lib/auditExport";
import { cn } from "../lib/utils";
import { sendMessage } from "./messaging";
import { AuditFindingsTable } from "./AuditFindingsTable";
import { GeminiSetupGate } from "./GeminiSetupGate";

const AUDIT_VIEWPORT = "desktop" as const;

const PIPELINE_STEPS = ["Tab", "Screenshots", "DOM", "Analyze", "Overlay"] as const;

type PanelTab = "overview" | "issues" | "page" | "log";

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

export default function App() {
  const [session, setSession] = useState<AuditSessionStored | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewSource, setReviewSource] = useState<"gemini" | "custom" | "demo" | null>(null);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [tab, setTab] = useState<PanelTab>("overview");

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
      settings?: { geminiApiKey?: string };
      reviewSource?: "gemini" | "custom" | "demo";
    }>({
      type: "AUDIT_GET_SETTINGS",
    }).then((r) => {
      if (r.reviewSource) setReviewSource(r.reviewSource);
      setHasGeminiKey(Boolean(r.settings?.geminiApiKey?.trim()));
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

  useEffect(() => {
    if (!busy) return;
    setStepIdx(0);
    const id = window.setInterval(() => {
      setStepIdx((i) => (i + 1) % PIPELINE_STEPS.length);
    }, 1100);
    return () => window.clearInterval(id);
  }, [busy]);

  const runAudit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await sendMessage<{ ok: boolean; session?: AuditSessionStored; error?: string }>({
        type: "AUDIT_RUN",
        viewportProfile: AUDIT_VIEWPORT,
      });
      if (!res.ok) throw new Error(res.error || "Something went wrong—try again or refresh the page.");
      if (res.session) setSession(res.session);
      setOverlayVisible(true);
      setTab("issues");
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

  const onGeminiSaved = () => {
    loadPanelSettings();
  };

  const needsGeminiGate = reviewSource === "demo" && !hasGeminiKey;

  const summary = session?.response.summary;
  const issueCount = session?.response.issues.length ?? 0;

  const reviewHint =
    reviewSource === "custom"
      ? "Custom review URL."
      : reviewSource === "gemini"
        ? "Gemini."
        : reviewSource === "demo"
          ? "Add Gemini key (default host)."
          : null;

  const meta = session?.meta;
  const am = session?.analysisMeta;

  const tabBtn = (id: PanelTab, label: string, icon: ReactNode, disabled?: boolean) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setTab(id)}
      className={cn(
        "flex min-w-0 flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-[11px] font-medium transition-colors",
        tab === id
          ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-50"
          : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="shrink-0 border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="flex items-start justify-between gap-3 p-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">FairFrame</h1>
            {reviewHint ? <p className="mt-0.5 text-[10px] text-zinc-500">{reviewHint}</p> : null}
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
        {!needsGeminiGate ? (
          <div className="flex border-t border-zinc-100 dark:border-zinc-800">
            {tabBtn("overview", "Overview", <SquareStack className="h-3.5 w-3.5" />)}
            {tabBtn("issues", `Issues${session ? ` (${issueCount})` : ""}`, <LayoutList className="h-3.5 w-3.5" />, !session)}
            {tabBtn("page", "Page", <MonitorSmartphone className="h-3.5 w-3.5" />, !session)}
            {tabBtn(
              "log",
              "Log",
              <ScrollText className="h-3.5 w-3.5" />,
              !session?.analysisLog?.length,
            )}
          </div>
        ) : null}
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {error ? (
          <div className="mx-3 mt-3 shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
            {error}
          </div>
        ) : null}

        {needsGeminiGate ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            <GeminiSetupGate onSaved={onGeminiSaved} />
            <p className="text-center text-[10px] text-zinc-500">
              <button type="button" className="underline" onClick={openOptions}>
                Settings
              </button>{" "}
              — custom API URL (no Gemini).
            </p>
          </div>
        ) : null}

        {!needsGeminiGate && tab === "overview" ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 pb-6">
            {busy ? (
              <Card className="border-blue-200/80 dark:border-blue-900/40">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                    Running…
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400">{PIPELINE_STEPS[stepIdx]}</p>
                  <div className="flex gap-1">
                    {PIPELINE_STEPS.map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-1 flex-1 rounded-full transition-colors",
                          i === stepIdx ? "bg-blue-600 dark:bg-blue-500" : "bg-zinc-200 dark:bg-zinc-800",
                        )}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <div className="flex flex-col gap-2 rounded-xl border border-zinc-200/90 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
              <Button type="button" className="h-11 w-full text-sm font-medium" disabled={busy} onClick={() => void runAudit()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                Run check
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" disabled={!session} onClick={() => setTab("issues")}>
                  <LayoutList className="h-4 w-4" />
                  Open issues
                </Button>
                <Button type="button" variant="outline" disabled={!session} onClick={() => void toggleOverlay()}>
                  {overlayVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {overlayVisible ? "Hide overlay" : "Show overlay"}
                </Button>
              </div>
            </div>

            {summary ? (
              <>
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
                      Small {summary.minor}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border bg-white px-2.5 py-1 text-[11px] font-medium dark:bg-zinc-900",
                        severityClass("suggestion"),
                      )}
                    >
                      Ideas {summary.suggestion}
                    </span>
                  </CardContent>
                </Card>

                {session?.comparison ? (
                  <Card className="border-emerald-200/90 dark:border-emerald-900/35">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        <GitCompare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        vs last run
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        Prior: {new Date(session.comparison.previousAnalyzedAt).toLocaleString()} ·{" "}
                        {session.comparison.previousTotal} issues
                      </p>
                    </CardHeader>
                    <CardContent className="grid grid-cols-3 gap-2 pt-0">
                      <div className="rounded-lg bg-emerald-50 py-2 text-center dark:bg-emerald-950/40">
                        <div className="text-base font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
                          {session.comparison.likelyResolved}
                        </div>
                        <div className="text-[9px] text-zinc-600 dark:text-zinc-400">Fixed</div>
                      </div>
                      <div className="rounded-lg bg-amber-50 py-2 text-center dark:bg-amber-950/40">
                        <div className="text-base font-semibold tabular-nums text-amber-900 dark:text-amber-200">
                          {session.comparison.likelyNew}
                        </div>
                        <div className="text-[9px] text-zinc-600 dark:text-zinc-400">New</div>
                      </div>
                      <div className="rounded-lg bg-zinc-100 py-2 text-center dark:bg-zinc-900">
                        <div className="text-base font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                          {session.comparison.likelyUnchanged}
                        </div>
                        <div className="text-[9px] text-zinc-600 dark:text-zinc-400">Same</div>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </>
            ) : (
              <p className="text-center text-xs text-zinc-500">No run yet.</p>
            )}
          </div>
        ) : null}

        {!needsGeminiGate && tab === "issues" && session ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => downloadText("fairframe-report.md", auditToMarkdown(session), "text/markdown")}
              >
                <Download className="h-3.5 w-3.5" />
                .md
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => downloadText("fairframe-report.json", auditToJson(session), "application/json")}
              >
                <Download className="h-3.5 w-3.5" />
                .json
              </Button>
            </div>
            {session.response.notes ? (
              <p className="shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                {session.response.notes}
              </p>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
              <AuditFindingsTable issues={session.response.issues} />
            </div>
          </div>
        ) : null}

        {!needsGeminiGate && tab === "issues" && !session ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm text-zinc-500">
            Run a check first.
          </div>
        ) : null}

        {!needsGeminiGate && tab === "page" && session && meta ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-6">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MonitorSmartphone className="h-4 w-4" />
                  Page
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 pt-0 sm:grid-cols-[minmax(0,1fr)_140px]">
                <dl className="space-y-1.5 text-[11px]">
                  <div>
                    <dt className="font-semibold text-zinc-700 dark:text-zinc-300">URL</dt>
                    <dd className="break-all font-mono text-zinc-600 dark:text-zinc-400">{meta.url}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-zinc-700 dark:text-zinc-300">Title</dt>
                    <dd className="text-zinc-600 dark:text-zinc-400">{meta.title || "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-zinc-700 dark:text-zinc-300">Viewport</dt>
                    <dd className="font-mono text-zinc-600 dark:text-zinc-400">
                      {meta.viewport.width}×{meta.viewport.height} · DPR {meta.viewport.devicePixelRatio} ·{" "}
                      <span className="capitalize">{meta.viewportProfile}</span>
                    </dd>
                  </div>
                  {meta.document ? (
                    <div>
                      <dt className="font-semibold text-zinc-700 dark:text-zinc-300">Document</dt>
                      <dd className="font-mono text-zinc-600 dark:text-zinc-400">
                        {meta.document.scrollWidth}×{meta.document.scrollHeight} · scroll ({Math.round(meta.document.scrollX)},{" "}
                        {Math.round(meta.document.scrollY)})
                      </dd>
                    </div>
                  ) : null}
                  {am ? (
                    <div>
                      <dt className="font-semibold text-zinc-700 dark:text-zinc-300">Analysis</dt>
                      <dd className="text-zinc-600 dark:text-zinc-400">
                        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">{am.engine}</code>
                        {am.textModel ? (
                          <>
                            {" "}
                            · <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">{am.textModel}</code>
                          </>
                        ) : null}
                        {am.imageModel ? (
                          <>
                            {" "}
                            · <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">{am.imageModel}</code>
                          </>
                        ) : null}
                        <br />
                        JPEGs: {am.screenshotStripCount ?? (am.hadViewportScreenshot ? 1 : 0)} · DOM {am.domNodesSent}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {session.viewportPreviewJpegBase64 ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-medium text-zinc-500">Thumbnail</span>
                    <img
                      alt=""
                      className="w-full rounded-md border border-zinc-200 object-cover dark:border-zinc-800"
                      src={`data:image/jpeg;base64,${session.viewportPreviewJpegBase64}`}
                    />
                  </div>
                ) : (
                  <p className="self-center text-center text-[10px] text-zinc-500">No thumbnail</p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {!needsGeminiGate && tab === "page" && !session ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm text-zinc-500">
            Run a check first.
          </div>
        ) : null}

        {!needsGeminiGate && tab === "log" && session?.analysisLog?.length ? (
          <div className="flex min-h-0 flex-1 flex-col p-3">
            <pre className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-200 bg-zinc-950 p-2 font-mono text-[10px] leading-relaxed text-emerald-100 dark:border-zinc-800">
              {session.analysisLog.join("\n")}
            </pre>
          </div>
        ) : null}
      </main>
    </div>
  );
}
