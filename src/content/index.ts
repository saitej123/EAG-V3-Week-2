import type { AuditIssue, ViewportProfile } from "../types/audit";
import {
  clearAuditOverlay,
  collectDomAuditSnapshot,
  renderAuditOverlay,
  setOverlayVisible,
} from "./auditDom";

const HOOK = "__ux_audit_content_v1";
const w = window as unknown as Record<string, boolean>;

type CollectMsg = { type: "AUDIT_COLLECT"; viewportProfile: ViewportProfile };
type OverlayMsg = {
  type: "AUDIT_RENDER_OVERLAY";
  issues: AuditIssue[];
};
type ToggleMsg = { type: "AUDIT_OVERLAY_TOGGLE"; visible: boolean };
type ClearMsg = { type: "AUDIT_OVERLAY_CLEAR" };

if (!w[HOOK]) {
  w[HOOK] = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "AUDIT_COLLECT") {
      const m = msg as CollectMsg;
      const profile: ViewportProfile =
        m.viewportProfile === "tablet" || m.viewportProfile === "mobile" ? m.viewportProfile : "desktop";
      try {
        const { nodes, meta } = collectDomAuditSnapshot(profile);
        sendResponse({ ok: true, nodes, meta });
      } catch (e) {
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
      return true;
    }

    if (msg?.type === "AUDIT_RENDER_OVERLAY") {
      const m = msg as OverlayMsg;
      try {
        renderAuditOverlay(
          (m.issues || []).map((i) => ({
            id: i.id,
            selector: i.selector,
            severity: i.severity,
            description: i.description,
            impactedUsers: i.impactedUsers,
            suggestedFix: i.suggestedFix,
            boundingBox: i.boundingBox,
          })),
        );
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
      return true;
    }

    if (msg?.type === "AUDIT_OVERLAY_TOGGLE") {
      const m = msg as ToggleMsg;
      setOverlayVisible(Boolean(m.visible));
      sendResponse({ ok: true });
      return true;
    }

    if (msg?.type === "AUDIT_OVERLAY_CLEAR") {
      clearAuditOverlay();
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });
}
