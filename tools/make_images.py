"""Render the README images into docs/ from an HTML mock of the Claude desktop app.

hero.png    -- the pane mid-run, paused at the push step, and the button in the footer
credits.png -- the pane alone after the credits roll, light beside dark
hero.png shows light above dark. Needs Playwright with Chromium: python tools/make_images.py
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

DOCS = Path(__file__).resolve().parent.parent / 'docs'

THEMES = {
    'light': dict(bg='#ffffff', panel='#f7f7f5', line='#e6e5e1', text='#1f1f1e', dim='#8b8a85',
                  input='#ffffff', claude='#d97757', ok='#2f9e44', wait='#c98a1b', bubble='#f0efeb'),
    'dark': dict(bg='#1f1f1e', panel='#262624', line='#3a3936', text='#ececea', dim='#8f8e89',
                 input='#2b2b29', claude='#e08a6c', ok='#51c26a', wait='#e3b341', bubble='#2c2c2a'),
}

RUN = [  # mark, colour key, label, note, bold
    ('✓', 'ok', 'Inventory', '3 files, 1 repo', False),
    ('✓', 'ok', 'Commit', '2 commits', False),
    ('✓', 'ok', 'Check', '12 tests pass', False),
    ('–', 'dim', 'Docs & lessons', 'README already current', False),
    ('‖', 'wait', 'Push & deploy', 'waiting for your OK', True),
    ('○', 'dim', 'Verify & clean up', '', False),
]
DONE = [
    ('✓', 'ok', 'Inventory', '3 files, 1 repo', False),
    ('✓', 'ok', 'Commit', '2 commits', False),
    ('✓', 'ok', 'Check', '12 tests pass', False),
    ('–', 'dim', 'Docs & lessons', 'README already current', False),
    ('✓', 'ok', 'Push & deploy', 'origin + Pages', False),
    ('✓', 'ok', 'Verify & clean up', 'site responds 200', False),
]
CREDITS = [
    ('Commits', ['a1b2c3d Add dark mode', 'e4f5a6b Fix login redirect']),
    ('Pushed', ['origin/main → e4f5a6b']),
    ('Deployed', ['https://example.pages.dev']),
    ('Still open', ['Release notes for v1.4']),
]


def steps_html(steps):
    rows = []
    for mark, key, label, note, bold in steps:
        dim = key == 'dim'
        rows.append(
            f'<div class="row"><span class="mark {key}">{mark}</span>'
            f'<span class="label{" dim" if dim else ""}{" bold" if bold else ""}">{label}</span>'
            f'<span class="note">{note}</span></div>')
    return ''.join(rows)


def credits_html():
    out = ['<div class="wrap">🎬 That\'s a wrap!</div>']
    for title, lines in CREDITS:
        out.append(f'<div class="sec">{title.upper()}</div>' + ''.join(f'<div class="cl">{x}</div>' for x in lines))
    return ''.join(out)


CHAT = '''<div class="chat">
    <div class="msgs">
      <div class="you">wrap up</div>
      <div class="bar w80"></div><div class="bar w60"></div><div class="bar w70"></div>
    </div>
    <div class="input"><span class="plus">+</span><span class="ph">Type / for commands</span></div>
    <div class="footer"><span class="btn">🎬 That's a wrap</span><span class="model">Opus 5.5</span>
      <span class="eff">Medium</span><span class="model">Auto</span></div>
  </div>'''


def frame(t, steps, credits, chat=True):
    c = THEMES[t]
    return f'''
<div class="frame{'' if chat else ' solo'}" style="--bg:{c['bg']};--panel:{c['panel']};--line:{c['line']};--text:{c['text']};--dim:{c['dim']};
  --input:{c['input']};--claude:{c['claude']};--ok:{c['ok']};--wait:{c['wait']};--bubble:{c['bubble']}">
  {CHAT if chat else ''}
  <div class="pane">
    <div class="title"><span>🎬 That's a wrap</span><span class="x">×</span></div>
    <div class="scene">SCENE · WRAP-UP</div>
    {steps_html(steps)}
    {credits_html() if credits else ''}
  </div>
</div>'''


CSS = '''
* { box-sizing: border-box; margin: 0; }
body { background: transparent; font: 14px "Segoe UI", system-ui, sans-serif; }
#shot { width: 900px; padding: 8px; display: flex; flex-direction: column; gap: 14px; }
.frame { display: flex; gap: 14px; background: var(--bg); color: var(--text); border: 1px solid var(--line);
  border-radius: 14px; padding: 18px; }
.chat { flex: 1; display: flex; flex-direction: column; }
.msgs { flex: 1; display: flex; flex-direction: column; gap: 9px; padding: 4px 6px 16px; }
.you { align-self: flex-end; background: var(--bubble); border-radius: 12px; padding: 7px 12px; }
.bar { height: 9px; border-radius: 5px; background: var(--bubble); }
.w80 { width: 80%; } .w60 { width: 60%; } .w70 { width: 70%; }
.input { display: flex; align-items: center; gap: 12px; background: var(--input); border: 1px solid var(--line);
  border-radius: 14px; padding: 11px 16px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.plus { font-size: 20px; line-height: 1; } .ph { color: var(--dim); font-size: 15px; }
.footer { display: flex; justify-content: flex-end; align-items: center; gap: 12px; padding: 9px 6px 0; }
.btn { color: var(--dim); } .model { color: var(--text); } .eff { color: var(--dim); }
.solo { flex: 1; padding: 0; border: 0; background: transparent; }
.solo .pane { width: 100%; }
.pane { width: 330px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 12px 16px 16px; }
.title { display: flex; justify-content: space-between; font-weight: 600; padding-bottom: 10px;
  border-bottom: 1px solid var(--line); margin-bottom: 10px; }
.x { color: var(--dim); font-weight: 400; }
.scene, .sec { color: var(--dim); font-size: 12px; letter-spacing: .06em; margin-bottom: 6px; }
.sec { margin: 10px 0 2px; }
.row { display: flex; gap: 8px; align-items: baseline; padding: 3px 0; white-space: nowrap; }
.mark { width: 14px; text-align: center; font-weight: 600; }
.mark.ok { color: var(--ok); } .mark.wait { color: var(--wait); } .mark.dim { color: var(--dim); }
.label.dim, .note { color: var(--dim); } .bold { font-weight: 600; }
.note { font-size: 13px; overflow: hidden; text-overflow: ellipsis; }
.wrap { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); color: var(--claude); font-weight: 700; }
.cl { font-size: 13px; }
'''


def render(page, name, steps, credits, chat=True):
    shot = '' if chat else ' style="flex-direction:row;width:760px"'
    html = (f'<html><head><meta charset="utf-8"><style>{CSS}</style></head><body><div id="shot"{shot}>'
            + frame('light', steps, credits, chat) + frame('dark', steps, credits, chat) + '</div></body></html>')
    page.set_content(html)
    page.locator('#shot').screenshot(path=str(DOCS / name), omit_background=True)
    print('wrote', DOCS / name)


DOCS.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(device_scale_factor=2)
    render(page, 'hero.png', RUN, False)
    render(page, 'credits.png', DONE, True, chat=False)
    browser.close()
