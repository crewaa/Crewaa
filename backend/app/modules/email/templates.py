"""
The Royal Peacock email (V3 Phase 4).

Table layout with inline styles, because that is what email clients render
consistently. Every piece of text is escaped: notification bodies carry other
people's words (message previews, feedback), and an email is no place to find
out they contained HTML.
"""

from dataclasses import dataclass
from html import escape

from app.core.config import settings

BG = "#071A1F"
SURFACE = "#0D252B"
LINE = "#1C3B43"
TEXT = "#EAF4F3"
MUTED = "#8FB0B0"
TEAL = "#26BDB0"
ON_TEAL = "#03201C"
GOLD = "#D8B45A"

FONT = "'Instrument Sans', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"


@dataclass
class Rendered:
    html: str
    text: str


def absolute(link: str | None) -> str | None:
    if not link:
        return None
    if link.startswith("http://") or link.startswith("https://"):
        return link
    return settings.frontend_url.rstrip("/") + "/" + link.lstrip("/")


def render_email(
    *,
    subject: str,
    body: str,
    cta_label: str | None = None,
    cta_url: str | None = None,
    reason: str,
    unsubscribe_url: str | None = None,
    settings_url: str | None = None,
) -> Rendered:
    """
    `reason` says why this person got the email ("You're getting this because
    someone messaged you on Crewaa."). `unsubscribe_url` and `settings_url` are
    left out for one-off confirmations that have nothing to switch off.
    """
    home = settings.frontend_url.rstrip("/")
    paragraphs = "".join(
        f'<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:{TEXT};">{escape(p)}</p>'
        for p in body.split("\n\n") if p.strip()
    )

    button = ""
    if cta_label and cta_url:
        button = f"""
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 6px;">
          <tr><td bgcolor="{TEAL}" style="border-radius:999px;">
            <a href="{escape(cta_url, quote=True)}" style="display:inline-block;padding:13px 26px;font-family:{FONT};font-size:15px;font-weight:600;color:{ON_TEAL};text-decoration:none;border-radius:999px;">{escape(cta_label)}</a>
          </td></tr>
        </table>"""

    links = []
    if settings_url:
        links.append(f'<a href="{escape(settings_url, quote=True)}" style="color:{MUTED};text-decoration:underline;">Email settings</a>')
    if unsubscribe_url:
        links.append(f'<a href="{escape(unsubscribe_url, quote=True)}" style="color:{MUTED};text-decoration:underline;">Unsubscribe</a>')
    links_html = " &nbsp;·&nbsp; ".join(links)

    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>{escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background:{BG};" bgcolor="{BG}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{escape(body[:120])}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="{BG}" style="background:{BG};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;font-family:{FONT};">
      <tr><td style="padding:0 4px 22px;">
        <a href="{escape(home, quote=True)}" style="text-decoration:none;">
          <img src="{escape(home, quote=True)}/email-logo.png" width="120" height="36" alt="Crewaa" style="display:block;border:0;height:36px;width:120px;color:{TEAL};font-size:22px;font-weight:700;">
        </a>
      </td></tr>
      <tr><td bgcolor="{SURFACE}" style="background:{SURFACE};border:1px solid {LINE};border-radius:20px;padding:32px 30px;">
        <div style="height:3px;width:44px;background:{GOLD};border-radius:3px;margin:0 0 22px;"></div>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:600;color:{TEXT};">{escape(subject)}</h1>
        {paragraphs}
        {button}
      </td></tr>
      <tr><td style="padding:22px 6px 0;font-size:12.5px;line-height:1.6;color:{MUTED};">
        {escape(reason)}<br>
        {links_html}
        <p style="margin:14px 0 0;color:{MUTED};">Crewaa · Brands, businesses and creators. One crew.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>"""

    text_parts = [subject, "", body]
    if cta_label and cta_url:
        text_parts += ["", f"{cta_label}: {cta_url}"]
    text_parts += ["", "—", reason]
    if settings_url:
        text_parts.append(f"Email settings: {settings_url}")
    if unsubscribe_url:
        text_parts.append(f"Unsubscribe: {unsubscribe_url}")
    return Rendered(html=html, text="\n".join(text_parts))
