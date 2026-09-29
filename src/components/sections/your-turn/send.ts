import { yourTurn } from "@/content/copy";
import { REPLY_WHATSAPP, SITE_TITLE } from "@/content/site";

/**
 * Sends a song link on its way. In order: a WhatsApp chat with him
 * (when his number is set), the device's own share sheet (phones, and
 * desktop Safari, Chrome and Edge), and finally the clipboard (which
 * the caller confirms with a toast).
 */

export type SendResult = "opened" | "shared" | "copied" | "cancelled" | "failed";

export async function sendSong(url: string, { promptLabel }: { promptLabel: string }): Promise<SendResult> {
  const text = yourTurn.shareText;
  const message = `${text} ${url}`;

  // must happen synchronously inside the tap, or it's a blocked pop-up
  const whatsapp = REPLY_WHATSAPP.replace(/\D/g, "");
  if (whatsapp) {
    // (with noopener, window.open returns null even when it worked)
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    return "opened";
  }

  const data: ShareData = { title: SITE_TITLE, text, url };
  if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare(data))) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // anything else: fall through to the clipboard
    }
  }

  if (await copy(message)) return "copied";

  // last resort: let her copy it by hand
  window.prompt(promptLabel, url);
  return "failed";
}

async function copy(text: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* permission or focus: try the old way */
  }
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const area = document.createElement("textarea");
  try {
    area.value = text;
    area.setAttribute("readonly", "");
    // 16px keeps iOS from zooming; off-screen keeps it from being seen
    area.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0;font-size:16px;";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
    focused?.focus({ preventScroll: true });
  }
}
