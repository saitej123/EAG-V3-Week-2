import type { AuditRequestPayload, AuditSessionStored, ViewportProfile } from "../types/audit";
import { postAuditAnalyze } from "./auditApi";
import { getAuditSettings, isDemoApiBase } from "./auditSettings";
import { validateGeminiApiKey } from "./validateKey";
import { sendToTabWithInject } from "./auditTab";
import { getTargetTabForCapture } from "./activeTab";
import { isHostileExtensionUrl } from "./tabCapture";
import { captureViewportJpegBase64 } from "./viewportCapture";

const SESSION_LAST = "auditLastSession";
const SESSION_OVERLAY_ON = "auditOverlayVisible";

function stripMockupBinary(s: AuditSessionStored): AuditSessionStored {
  return {
    ...s,
    response: {
      ...s.response,
      issues: s.response.issues.map((i) => {
        const copy = { ...i };
        delete copy.mockupImageBase64;
        delete copy.mockupImageMime;
        return copy;
      }),
    },
  };
}

async function persistAuditSession(stored: AuditSessionStored): Promise<void> {
  const write = (data: AuditSessionStored) =>
    new Promise<void>((resolve, reject) => {
      chrome.storage.session.set({ [SESSION_LAST]: data, [SESSION_OVERLAY_ON]: true }, () => {
        const e = chrome.runtime.lastError;
        if (e) reject(new Error(e.message));
        else resolve();
      });
    });
  try {
    await write(stored);
  } catch {
    try {
      await write(stripMockupBinary(stored));
    } catch {
      /* ignore — session still usable in-memory for overlay */
    }
  }
}

function enableSidePanel() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    /* ignore */
  });
}

chrome.runtime.onInstalled.addListener(enableSidePanel);
enableSidePanel();

chrome.commands.onCommand.addListener((command) => {
  if (command === "run-fairframe-review") {
    void runAuditFlow(undefined, true);
  }
});

async function runAuditFlow(
  viewportProfile?: ViewportProfile,
  fromCommand?: boolean,
): Promise<AuditSessionStored> {
  const tab = await getTargetTabForCapture();
  const tabId = tab.id!;
  const tabUrl = tab.url ?? tab.pendingUrl;

  if (isHostileExtensionUrl(tabUrl)) {
    throw new Error(
      "This tab can’t be checked—built-in browser pages and the Web Store block extensions. Open a normal website first.",
    );
  }

  const settings = await getAuditSettings();
  const profile: ViewportProfile = viewportProfile ?? settings.defaultViewport;

  const collectRes = (await sendToTabWithInject(tabId, tabUrl, {
    type: "AUDIT_COLLECT",
    viewportProfile: profile,
  })) as {
    ok?: boolean;
    nodes?: AuditRequestPayload["dom"]["nodes"];
    meta?: AuditRequestPayload["meta"];
    error?: string;
  };

  if (!collectRes?.ok || !collectRes.nodes || !collectRes.meta) {
    throw new Error(collectRes?.error || "Could not read this page—try refreshing the tab.");
  }

  const jpeg = await captureViewportJpegBase64(72);

  const payload: AuditRequestPayload = {
    meta: collectRes.meta,
    screenshotViewportJpegBase64: jpeg,
    dom: { nodes: collectRes.nodes },
  };

  const response = await postAuditAnalyze(payload);

  const analyzedAt = Date.now();

  const stored: AuditSessionStored = {
    meta: payload.meta,
    response,
    analyzedAt,
    domNodeCount: payload.dom.nodes.length,
  };

  await persistAuditSession(stored);

  await sendToTabWithInject(tabId, tabUrl, {
    type: "AUDIT_RENDER_OVERLAY",
    issues: response.issues,
  }).catch(() => {
    /* tab might have navigated */
  });

  if (fromCommand && tab.windowId != null) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch {
      /* ignore */
    }
  }

  return stored;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === "AUDIT_GET_SETTINGS") {
      const settings = await getAuditSettings();
      const reviewSource: "gemini" | "custom" | "demo" = !isDemoApiBase(settings.apiBaseUrl)
        ? "custom"
        : settings.geminiApiKey
          ? "gemini"
          : "demo";
      sendResponse({ ok: true, settings, reviewSource });
      return;
    }

    if (message?.type === "AUDIT_VALIDATE_GEMINI_KEY") {
      const key = String(message.key || "").trim();
      const result = await validateGeminiApiKey(key);
      if (result.ok) sendResponse({ ok: true });
      else sendResponse({ ok: false, error: result.message });
      return;
    }

    if (message?.type === "AUDIT_RUN") {
      try {
        const vp = message.viewportProfile as ViewportProfile | undefined;
        const session = await runAuditFlow(vp, false);
        sendResponse({ ok: true, session });
      } catch (e) {
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
      return;
    }

    if (message?.type === "AUDIT_LOAD_LAST") {
      const s = await chrome.storage.session.get([SESSION_LAST, SESSION_OVERLAY_ON]);
      sendResponse({
        ok: true,
        session: s[SESSION_LAST] as AuditSessionStored | undefined,
        overlayVisible: Boolean(s[SESSION_OVERLAY_ON]),
      });
      return;
    }

    if (message?.type === "AUDIT_TOGGLE_OVERLAY") {
      const tab = await getTargetTabForCapture().catch(() => null);
      if (!tab?.id) {
        sendResponse({ ok: false, error: "No tab." });
        return;
      }
      const s = await chrome.storage.session.get(SESSION_OVERLAY_ON);
      const next = typeof message.visible === "boolean" ? message.visible : !Boolean(s[SESSION_OVERLAY_ON]);
      await chrome.storage.session.set({ [SESSION_OVERLAY_ON]: next });
      const tabUrl = tab.url ?? tab.pendingUrl;
      await sendToTabWithInject(tab.id, tabUrl, { type: "AUDIT_OVERLAY_TOGGLE", visible: next }).catch(() => {});
      sendResponse({ ok: true, visible: next });
      return;
    }

    if (message?.type === "AUDIT_CLEAR_OVERLAY") {
      const tab = await getTargetTabForCapture().catch(() => null);
      if (tab?.id) {
        const tabUrl = tab.url ?? tab.pendingUrl;
        await sendToTabWithInject(tab.id, tabUrl, { type: "AUDIT_OVERLAY_CLEAR" }).catch(() => {});
      }
      await chrome.storage.session.set({ [SESSION_OVERLAY_ON]: false });
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message." });
  })().catch((e) => {
    sendResponse({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  });

  return true;
});
