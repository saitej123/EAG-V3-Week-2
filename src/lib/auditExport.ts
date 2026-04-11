import type { AuditIssue, AuditSessionStored } from "../types/audit";

function appendPatches(parts: string[], issue: AuditIssue) {
  const p = issue.codePatches;
  if (!p) return;
  if (p.css) {
    parts.push(`#### CSS`, ``, "```css", p.css, "```", ``);
  }
  if (p.html) {
    parts.push(`#### HTML`, ``, "```html", p.html, "```", ``);
  }
  if (p.aria) {
    parts.push(`#### ARIA`, ``, "```", p.aria, "```", ``);
  }
}

export function auditToMarkdown(session: AuditSessionStored): string {
  const { meta, response, analyzedAt, domNodeCount } = session;
  const { summary, issues, notes } = response;

  const parts: string[] = [
    `# FairFrame — UX & accessibility review`,
    ``,
    `- **URL:** ${meta.url}`,
    `- **Title:** ${meta.title}`,
    `- **Viewport profile:** ${meta.viewportProfile} (${meta.viewport.width}×${meta.viewport.height} @ ${meta.viewport.devicePixelRatio}x DPR)`,
    `- **Analyzed:** ${new Date(analyzedAt).toISOString()}`,
    `- **DOM nodes sent:** ${domNodeCount}`,
  ];
  if (notes) parts.push(`- **Notes:** ${notes}`);
  parts.push(
    ``,
    `## Summary`,
    ``,
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Total | ${summary.total} |`,
    `| Critical | ${summary.critical} |`,
    `| Major | ${summary.major} |`,
    `| Minor | ${summary.minor} |`,
    `| Suggestion | ${summary.suggestion} |`,
    ``,
    `## Findings`,
    ``,
  );

  for (const issue of issues) {
    parts.push(`### [${issue.severity.toUpperCase()}] ${issue.type} (${issue.category})`, ``);
    if (issue.wcagReference) {
      parts.push(`**WCAG:** ${issue.wcagReference}`, ``);
    }
    parts.push(`**Summary:** ${issue.description}`, ``);
    if (issue.advancedRationale) {
      parts.push(`**Technical rationale:**`, ``, issue.advancedRationale, ``);
    }
    parts.push(`**Impacted:** ${issue.impactedUsers.join(", ")}`, ``);
    if (issue.implementationChecklist?.length) {
      parts.push(`**Implementation checklist:**`, ``);
      issue.implementationChecklist.forEach((step) => parts.push(`- ${step}`));
      parts.push(``);
    }
    parts.push(`**Primary fix:**`, ``, "```", issue.suggestedFix, "```", ``);
    appendPatches(parts, issue);
    parts.push(`**Selector:** \`${issue.selector.replace(/`/g, "\\`")}\``, ``);
    if (issue.mockupCaption || issue.mockupImageBase64) {
      parts.push(
        `**Visual mockup:** ${issue.mockupCaption || "(generated)"} — *binary image is included in the JSON export only.*`,
        ``,
      );
    }
    parts.push(`---`, ``);
  }

  return parts.join("\n");
}

export function auditToJson(session: AuditSessionStored): string {
  return JSON.stringify(session, null, 2);
}
