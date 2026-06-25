/**
 * Minimalistische Resend-client (alleen alert-mails).
 * Direct tegen de Resend REST-API — geen extra dependency, stabiel voor jaren.
 */
const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendAlertMail(input: SendMailInput): Promise<{
  ok: boolean;
  detail: string;
}> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "noreply@nederlanders.fr";

  if (!apiKey) {
    return { ok: false, detail: "RESEND_API_KEY ontbreekt." };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `nlfr-if-distributie <${from}>`,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.text();
    return { ok: res.ok, detail: `HTTP ${res.status} — ${body.slice(0, 300)}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Huisstijl-conforme HTML-wrapper voor alert-mails. */
export function alertHtml(opts: {
  kanaalNaam: string;
  alertType: string;
  errorMsg: string | null;
  suggestedAction: string;
  kanalenUrl: string;
}): string {
  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f5f2f2;font-family:Mulish,Arial,sans-serif;line-height:1.8em;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="border-top:4px solid #800000;background:#ffffff;border-radius:6px;padding:28px 28px 24px;">
      <h1 style="font-family:Poppins,Arial,sans-serif;font-size:18px;margin:0 0 4px;color:#800000;">
        ${escapeHtml(opts.kanaalNaam)}
      </h1>
      <p style="margin:0 0 20px;font-size:13px;color:#800000cc;text-transform:uppercase;letter-spacing:.04em;">
        ${escapeHtml(opts.alertType)}
      </p>
      ${
        opts.errorMsg
          ? `<p style="margin:0 0 16px;"><strong>Laatste melding:</strong><br>${escapeHtml(opts.errorMsg)}</p>`
          : ""
      }
      <p style="margin:0 0 24px;"><strong>Aanbevolen actie:</strong><br>${escapeHtml(opts.suggestedAction)}</p>
      <a href="${opts.kanalenUrl}"
         style="display:inline-block;background:#800000;color:#fff;text-decoration:none;
                padding:10px 20px;border-radius:4px;font-family:Poppins,Arial,sans-serif;font-size:14px;">
        Open kanalen-overzicht
      </a>
    </div>
    <p style="margin:16px 0 0;font-size:11px;color:#80000080;text-align:center;">
      nlfr-if-distributie — automatische monitor
    </p>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
