# ruff: noqa: E501  (the CSS below is one rule per line on purpose)
"""Renders a Verifier's recorded events as one self-contained HTML page (no
external assets), so a verification run can be read in a browser, attached to a
review, or shared with someone who never ran the command."""

from html import escape

_CSS = """
:root { --ok:#0a7d33; --bad:#c0271c; --ink:#1c2430; --mute:#5b6675; --line:#e2e6ec; --bg:#f6f8fb; }
@media (prefers-color-scheme: dark) {
  :root { --ok:#4cc37a; --bad:#ff7b72; --ink:#e6ebf2; --mute:#9aa6b6; --line:#2b3442; --bg:#11161d; }
  body { background:#0b0f14; }
  .card { background:#151b24; }
}
* { box-sizing: border-box; }
body { margin:0; font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; color:var(--ink); background:var(--bg); }
main { max-width: 960px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 22px; margin: 0 0 4px; }
.meta { color: var(--mute); margin-bottom: 16px; }
.summary { display:flex; gap:12px; flex-wrap:wrap; margin: 16px 0 24px; }
.pill { padding: 8px 14px; border-radius: 999px; font-weight: 600; border:1px solid var(--line); background:#fff; }
@media (prefers-color-scheme: dark) { .pill { background:#151b24; } }
.pill.ok { color: var(--ok); } .pill.bad { color: var(--bad); }
.card { background:#fff; border:1px solid var(--line); border-radius: 10px; padding: 4px 16px 12px; margin-bottom: 16px; }
h2 { font-size: 16px; margin: 14px 0 8px; }
.row { display:flex; gap:10px; padding: 6px 0; border-top:1px solid var(--line); align-items:flex-start; }
.row:first-of-type { border-top: 0; }
.badge { font: 700 11px/1 ui-monospace,Consolas,monospace; padding: 4px 7px; border-radius: 4px; color:#fff; flex:none; margin-top:3px; }
.badge.ok { background: var(--ok); } .badge.bad { background: var(--bad); }
.detail { color: var(--bad); font: 13px ui-monospace,Consolas,monospace; margin-top: 2px; word-break: break-word; }
.trace { font: 12.5px ui-monospace,Consolas,monospace; color: var(--mute); padding: 2px 0 2px 42px; word-break: break-all; }
.trace b { color: var(--ink); font-weight: 600; }
.st { font-weight: 700; } .st.s2 { color: var(--ok); } .st.s4, .st.s5 { color: var(--bad); }
.note { color: var(--mute); padding: 2px 0 2px 42px; }
pre { background:var(--bg); border:1px solid var(--line); padding:12px; border-radius:8px; overflow:auto; font-size:12.5px; }
details summary { cursor:pointer; color: var(--mute); padding: 4px 0 4px 42px; font-size: 13px; }
"""


def _status_class(status):
    return f"s{str(status)[0]}"


def render_html(title, verifier, elapsed):
    total = verifier.passed + verifier.failed
    verdict_class = "bad" if verifier.failed else "ok"
    verdict = "FAILED" if verifier.failed else "ALL CHECKS PASSED"

    body = []
    open_card = False
    pending_traces = []

    def flush_traces():
        if not pending_traces:
            return
        lines = "".join(
            f'<div class="trace"><b>{escape(who)}</b> {escape(method)} {escape(path)} '
            f'&rarr; <span class="st {_status_class(status)}">{status}</span>'
            f'{" (" + escape(str(detail)) + ")" if detail else ""}</div>'
            for who, method, path, status, detail in pending_traces
        )
        body.append(
            f"<details><summary>{len(pending_traces)} request(s)</summary>{lines}</details>"
        )
        pending_traces.clear()

    for event in verifier.events:
        kind = event[0]
        if kind == "section":
            flush_traces()
            if open_card:
                body.append("</div>")
            body.append(f'<div class="card"><h2>{escape(event[1])}</h2>')
            open_card = True
        elif kind == "trace":
            pending_traces.append(event[1:])
        elif kind == "check":
            flush_traces()
            _, ok, label, detail = event
            badge = (
                '<span class="badge ok">PASS</span>'
                if ok
                else '<span class="badge bad">FAIL</span>'
            )
            extra = f'<div class="detail">{escape(detail)}</div>' if detail else ""
            body.append(f'<div class="row">{badge}<div>{escape(label)}{extra}</div></div>')
        elif kind == "note":
            flush_traces()
            body.append(f'<div class="note">{escape(event[1])}</div>')
        elif kind == "block":
            flush_traces()
            body.append(f"<pre>{escape(event[1])}</pre>")
    flush_traces()
    if open_card:
        body.append("</div>")

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)}</title><style>{_CSS}</style></head>
<body><main>
<h1>{escape(title)}</h1>
<div class="meta">Ran against the real API and database; all changes rolled back afterwards.</div>
<div class="summary">
  <span class="pill {verdict_class}">{verdict}</span>
  <span class="pill">{verifier.passed}/{total} checks passed</span>
  <span class="pill">{elapsed:.1f}s</span>
</div>
{"".join(body)}
</main></body></html>"""
