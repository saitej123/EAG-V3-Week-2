import { useEffect, useState } from "react";
import type { AuditIssue } from "../types/audit";
import { cn } from "../lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

function sevBadge(sev: string) {
  const base = "shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide";
  switch (sev) {
    case "critical":
      return cn(base, "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200");
    case "major":
      return cn(base, "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200");
    case "minor":
      return cn(base, "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200");
    default:
      return cn(base, "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200");
  }
}

type Props = {
  issues: AuditIssue[];
};

export function AuditFindingsTable({ issues }: Props) {
  const [openId, setOpenId] = useState<string | null>(issues[0]?.id ?? null);

  useEffect(() => {
    if (issues.length === 0) {
      setOpenId(null);
      return;
    }
    setOpenId((prev) => {
      if (prev && issues.some((i) => i.id === prev)) return prev;
      return issues[0]!.id;
    });
  }, [issues]);

  if (issues.length === 0) {
    return <p className="text-xs text-zinc-500">No findings in this run.</p>;
  }

  return (
    <ul className="space-y-2" aria-label="Audit findings">
      {issues.map((issue) => {
        const isOpen = openId === issue.id;
        return (
          <li
            key={issue.id}
            className={cn(
              "overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
              isOpen && "ring-1 ring-zinc-300 dark:ring-zinc-600",
            )}
          >
            <button
              type="button"
              className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/80"
              onClick={() => setOpenId(isOpen ? null : issue.id)}
              aria-expanded={isOpen}
            >
              <span className="mt-0.5 text-zinc-400">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </span>
              <span className={sevBadge(issue.severity)}>{issue.severity}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-[11px] font-semibold capitalize text-zinc-800 dark:text-zinc-100">
                    {issue.category}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500">{issue.type}</span>
                  {issue.mockupImageBase64 ? (
                    <span className="rounded bg-violet-100 px-1.5 py-0 text-[9px] font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                      mockup
                    </span>
                  ) : null}
                  {issue.analysisTags?.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-zinc-200 px-1.5 py-0 text-[9px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-[12px] leading-snug text-zinc-700 dark:text-zinc-300">{issue.description}</p>
                <p className="mt-1 line-clamp-2 break-all font-mono text-[10px] text-zinc-500">{issue.selector}</p>
              </div>
            </button>
            {isOpen ? (
              <div className="space-y-3 border-t border-zinc-100 px-3 py-3 text-[11px] dark:border-zinc-800">
                {issue.boundingBox ? (
                  <p className="font-mono text-[10px] text-zinc-600 dark:text-zinc-400">
                    BBox (doc): {Math.round(issue.boundingBox.x)}, {Math.round(issue.boundingBox.y)} ·{" "}
                    {Math.round(issue.boundingBox.width)}×{Math.round(issue.boundingBox.height)}
                  </p>
                ) : null}
                {issue.wcagReference ? (
                  <p>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">WCAG: </span>
                    <span className="text-zinc-700 dark:text-zinc-300">{issue.wcagReference}</span>
                  </p>
                ) : null}
                {issue.advancedRationale ? (
                  <div>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">Technical rationale</p>
                    <p className="mt-1 whitespace-pre-wrap leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {issue.advancedRationale}
                    </p>
                  </div>
                ) : null}
                {issue.implementationChecklist?.length ? (
                  <div>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">Implementation checklist</p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5 text-zinc-700 dark:text-zinc-300">
                      {issue.implementationChecklist.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <p>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">Impacted: </span>
                  {issue.impactedUsers.join(", ")}
                </p>
                <div>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">Primary fix</p>
                  <pre className="mt-1 max-h-48 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-[10px] leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                    {issue.suggestedFix}
                  </pre>
                </div>
                {issue.codePatches?.css ? (
                  <div>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">CSS</p>
                    <pre className="mt-1 max-h-36 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2 font-mono text-[10px] dark:border-zinc-800 dark:bg-zinc-900">
                      {issue.codePatches.css}
                    </pre>
                  </div>
                ) : null}
                {issue.codePatches?.html ? (
                  <div>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">HTML</p>
                    <pre className="mt-1 max-h-36 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2 font-mono text-[10px] dark:border-zinc-800 dark:bg-zinc-900">
                      {issue.codePatches.html}
                    </pre>
                  </div>
                ) : null}
                {issue.codePatches?.aria ? (
                  <div>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">ARIA</p>
                    <pre className="mt-1 max-h-36 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2 font-mono text-[10px] dark:border-zinc-800 dark:bg-zinc-900">
                      {issue.codePatches.aria}
                    </pre>
                  </div>
                ) : null}
                {issue.mockupImageBase64 ? (
                  <div>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">Image model mockup</p>
                    {issue.mockupCaption ? <p className="text-[10px] text-zinc-500">{issue.mockupCaption}</p> : null}
                    <img
                      alt=""
                      className="mt-2 max-h-64 w-full rounded-lg border border-zinc-200 object-contain dark:border-zinc-800"
                      src={`data:${issue.mockupImageMime || "image/png"};base64,${issue.mockupImageBase64}`}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
