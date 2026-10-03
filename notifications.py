import json
import os
import re
import subprocess
import sys
import threading
from datetime import datetime
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parent / 'data'
CONFIG = ROOT / 'signin-notifications.json'

def push(title, message, cfg):
    jobs = []
    if cfg.get('pushplus_token'):
        jobs.append(('PushPlus', 'https://www.pushplus.plus/send', {'token': cfg['pushplus_token'], 'title': title, 'content': message, 'template': 'txt'}))
    if cfg.get('serverchan_sendkey'):
        key = cfg['serverchan_sendkey']
        jobs.append(('Server酱', f'https://sctapi.ftqq.com/{key}.send', {'title': title, 'desp': message}))
    if cfg.get('telegram_bot_token') and cfg.get('telegram_chat_id'):
        jobs.append(('Telegram', 'https://api.telegram.org/bot' + cfg['telegram_bot_token'] + '/sendMessage', {'chat_id': cfg['telegram_chat_id'], 'text': title + '\n' + message}))
    for name, url, payload in jobs:
        try:
            r = requests.post(url, json=payload, timeout=12)
            r.raise_for_status()
            result = r.json()
            ok = result.get('ok') if name == 'Telegram' else result.get('code') in (0, 200)
            print(f'{name}: ' + ('已提交推送' if ok else '服务拒绝推送，请检查配置/额度'), flush=True)
        except Exception as exc:
            # Never print exception URLs containing tokens.
            print(f'{name}: 推送失败 ({type(exc).__name__})', flush=True)

class Alerts:
    def __init__(self, url):
        self.url = url
        match = re.search(r'/courses/(\d+)', url)
        self.course = match.group(1) if match else 'unknown'
        self.children = []

    def notify(self, old, new):
        ROOT.mkdir(exist_ok=True)
        event = {'time': datetime.now().astimezone().isoformat(), 'course': self.course, 'old': str(old), 'new': str(new), 'url': self.url}
        with (ROOT / f'signin-events-{self.course}.jsonl').open('a', encoding='utf-8') as f:
            f.write(json.dumps(event, ensure_ascii=False) + '\n')
        try:
            cfg = json.loads(CONFIG.read_text(encoding='utf-8-sig'))
        except Exception:
            cfg = {}
            print('提醒配置不可读取，使用桌面、弹窗和声音默认设置')
        title = f'课程 {self.course} 签到号变化'
        message = f'{old} → {new}\n{event["time"]}\n{self.url}'
        self.children = [p for p in self.children if p.poll() is None]
        if cfg.get('desktop', True) or cfg.get('popup', True) or cfg.get('sound', True):
            self.children.append(subprocess.Popen([sys.executable, str(Path(__file__)), title, message, json.dumps({k: cfg.get(k, True) for k in ("desktop", "popup", "sound")})], creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0))
        threading.Thread(target=push, args=(title, message, cfg), daemon=True).start()

    def close(self):
        for child in self.children:
            if child.poll() is None:
                child.terminate()


def local_alert(title, message, cfg):
    if cfg.get('desktop', True):
        try:
            from winotify import Notification
            Notification(app_id='SJTU 签到监控', title=title, msg=message, duration='long').show()
        except Exception:
            pass
    stop = threading.Event()
    def sound():
        import winsound
        while not stop.is_set():
            try:
                winsound.Beep(1100, 350)
                winsound.Beep(1400, 350)
            except Exception:
                pass
            stop.wait(2)
    if cfg.get('sound', True):
        threading.Thread(target=sound, daemon=True).start()
    try:
        if cfg.get('popup', True):
            import tkinter as tk
            root = tk.Tk()
            root.title(title)
            root.attributes('-topmost', True)
            tk.Label(root, text=message, wraplength=520, padx=25, pady=25, font=('Microsoft YaHei', 12)).pack()
            tk.Button(root, text='已收到，停止声音', command=root.destroy, padx=20, pady=10).pack(pady=15)
            root.mainloop()
        elif cfg.get('sound', True):
            # Without a confirmation popup, bound the sound to 30 seconds.
            stop.wait(30)
    finally:
        stop.set()

if __name__ == '__main__':
    local_alert(sys.argv[1], sys.argv[2], json.loads(sys.argv[3]))
