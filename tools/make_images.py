"""Render the README images into docs/ from an HTML mock of the Claude desktop app.

hero.png    -- the bar above the prompt mid-run, paused at the push step, and the button in the footer
credits.png -- the bar's closing line
Both show light above dark. Needs Playwright with Chromium: python tools/make_images.py
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

DOCS = Path(__file__).resolve().parent.parent / 'docs'

THEMES = {
    'light': dict(bg='#ffffff', band='#f3f2ee', line='#e6e5e1', text='#1f1f1e', dim='#8b8a85',
                  input='#ffffff', bubble='#f0efeb'),
    'dark': dict(bg='#1f1f1e', band='#2a2a28', line='#3a3936', text='#ececea', dim='#8f8e89',
                 input='#2b2b29', bubble='#2c2c2a'),
}

# The plugin's dots: done green, skipped grey, current orange, not reached hollow (usage-rings colours).
RUN = [('●', 'ok'), ('●', 'ok'), ('●', 'ok'), ('●', 'skip'), ('●', 'wait'), ('○', 'dim')]


def band(label, note, done):
    if done:
        line = "<span class=\"b\">🎬 That's a wrap!</span>"
    else:
        dots = ''.join(f'<span class="{key}">{mark}</span>' for mark, key in RUN)
        line = f'<span class="dots">{dots}</span><span class="b">{label}</span><span class="nt">· {note}</span>'
    return f'<div class="band"><div class="ln">{line}</div></div>'


def frame(t, label, note, done):
    c = THEMES[t]
    return f'''
<div class="frame" style="--bg:{c['bg']};--band:{c['band']};--line:{c['line']};--text:{c['text']};--dim:{c['dim']};
  --input:{c['input']};--bubble:{c['bubble']}">
  <div class="msgs">
    <div class="you">wrap up</div>
    <div class="bar w80"></div><div class="bar w60"></div>
  </div>
  {band(label, note, done)}
  <div class="input"><span class="plus">+</span><span class="ph">Type / for commands</span></div>
  <div class="footer"><span class="btn">🎬 That's a wrap</span><span class="model">Opus 5.5</span>
    <span class="eff">Medium</span><span class="model">Auto</span></div>
</div>'''


CSS = '''
* { box-sizing: border-box; margin: 0; }
body { background: transparent; font: 14px "Segoe UI", system-ui, sans-serif; }
#shot { width: 720px; padding: 8px; display: flex; flex-direction: column; gap: 14px; }
.frame { display: flex; flex-direction: column; background: var(--bg); color: var(--text);
  border: 1px solid var(--line); border-radius: 14px; padding: 18px 18px 12px; }
.msgs { display: flex; flex-direction: column; gap: 9px; padding: 0 6px 22px; }
.you { align-self: flex-end; background: var(--bubble); border-radius: 12px; padding: 7px 12px; }
.bar { height: 9px; border-radius: 5px; background: var(--bubble); }
.w80 { width: 80%; } .w60 { width: 60%; }
.band { background: var(--band); border-radius: 12px; padding: 9px 14px; margin-bottom: 10px; }
.ln { display: flex; gap: 10px; align-items: baseline; white-space: nowrap; }
.dots { display: flex; } .ok { color: #34c759; } .wait { color: #ff9500; } .skip { color: #c7c7cc; }
.dim { color: var(--dim); } .b { font-weight: 600; }
.nt { color: var(--dim); overflow: hidden; text-overflow: ellipsis; }
.input { display: flex; align-items: center; gap: 12px; background: var(--input); border: 1px solid var(--line);
  border-radius: 14px; padding: 11px 16px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.plus { font-size: 20px; line-height: 1; } .ph { color: var(--dim); font-size: 15px; }
.footer { display: flex; justify-content: flex-end; align-items: center; gap: 12px; padding: 9px 6px 0; }
.btn { color: var(--dim); } .model { color: var(--text); } .eff { color: var(--dim); }
'''


def render(page, name, label, note, done):
    html = (f'<html><head><meta charset="utf-8"><style>{CSS}</style></head><body><div id="shot">'
            + frame('light', label, note, done) + frame('dark', label, note, done) + '</div></body></html>')
    page.set_content(html)
    page.locator('#shot').screenshot(path=str(DOCS / name), omit_background=True)
    print('wrote', DOCS / name)


DOCS.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(device_scale_factor=2)
    render(page, 'hero.png', 'Push & deploy', 'on your cue', False)
    render(page, 'credits.png', '', '', True)
    browser.close()
