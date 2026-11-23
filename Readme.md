# SJTU Canvas 签到提醒

## 快速开始

[直接下载 Edge 安装包 1.1.19](https://raw.githubusercontent.com/determine123/SJTU_SignIn_Monitor/main/downloads/sjtu-signin-monitor-1.1.19.zip)

1. 解压安装包，打开 `edge://extensions`，开启「开发人员模式」。
2. 选择「加载解压缩的扩展」，选中解压出来的 `edge-signin-monitor` 文件夹。
3. 在 Edge 播放 Canvas 直播，从扩展面板打开「直播扫码」，点击「选择直播标签页」，共享课堂标签页。
4. 点击「测试桌面通知」，确认 Windows 能显示提醒。直播扫码无需填写课程编号或设置手机推送，语音识别默认关闭。

有效签到码和普通二维码分开显示。读到二维码后会发桌面通知，普通码内容可在扫码页展开。Canvas 签到链接可按设置自动打开，交大独立签到系统的链接由使用者打开。签到结果以学校页面为准。

已有安装先在 Edge 的扩展详情确认原加载目录，把新版文件复制到该目录后点击「重新加载」，再重新共享直播标签页。

## 其他功能

推荐使用 edge-signin-monitor：在 edge://extensions 开启开发人员模式，加载该目录。每次 Edge 启动后点击图标才开始工作。自行填写课程编号及课表，支持课前30分钟、桌面、声音与可选手机提醒。无内置个人课表、推送密钥或登录资料。

Python 版：pip install -r requirements-lock.txt。将示例配置复制到 data/signin-notifications.json 并填写自己的推送参数。优先复用 browser/ 中自行准备的匹配 Chrome 与驱动；未提供时由 Selenium Manager 使用本机 Chrome。可用 CHROME_BINARY 指定浏览器可执行文件，按原说明运行。登录由使用者手动完成。数据和登录状态保存在被 Git 忽略的 data/ 与 profiles/。

不会自动签到；需要浏览器运行且电脑不休眠，手机推送取决于服务权限与送达情况。


## 原仓库与来源

本仓库基于 [IcekyPrime/SJTU_SignIn_Monitor](https://github.com/IcekyPrime/SJTU_SignIn_Monitor)，保留原项目提交历史。本账号提供本地部署改进及 Edge 扩展；原作者与本地修改的来源分别注明，使用时遵守上游许可及平台规则。

### 停课日期

在扩展课表的高级 JSON 导入中，可为某门课程添加 `"skipDates": ["2026-10-12", "2026-10-19"]`，跳过放假或临时取消的课前提醒。日期使用北京时间，保存课表后旧提醒会重新安排；不填此字段时保持原有课表。它只取消指定日期，不自动推算补课，补课请另行添加课程提醒。

### 提前录入新学期课表

课表起始日期距今超过两周时，扩展也会从课程起始日期寻找第一节有效课程，并按上课前30分钟安排提醒。停课日期与课程结束日期仍生效。

连续停课超过两周时，会继续寻找下一节有效课程；单双周第一周的 anchor 在未来时，从该周开始规划，不提前发出提醒。
## 本地 Qwen3-ASR 转写测试

在独立 Python 环境中安装 `qwen-asr` 和适合本机的 PyTorch，下载 [Qwen3-ASR-0.6B 模型](https://huggingface.co/Qwen/Qwen3-ASR-0.6B) 到本地目录。运行时直接读取本地文件，可一次传入多段音频，模型只加载一次。

```powershell
python tools/local_asr.py recording.wav --model D:\models\Qwen3-ASR-0.6B --language Chinese --keyword 签到 --keyword 点名
```

输出每段音频的转写文本、匹配关键词、模型加载耗时和推理耗时。默认自动选择 CUDA 或 CPU，可用 `--device cpu` 固定测试设备。关键词匹配用于提示，结果取决于源音频内容与质量。

## Windows 全屏二维码提醒

```powershell
python -m pip install -r requirements-qr.txt
python tools/screen_qr.py --test-sound
python tools/screen_qr.py --show-url
```

把 Canvas 直播留在可见的屏幕上。脚本约每秒扫描一次所有显示器，发现上海交大移动学习的签到二维码时鸣叫并提示，按 Ctrl+C 停止。同一个码持续可见时只提醒一次，离开画面至少 10 秒后再出现会重新提醒。签到请在学校页面手动确认。

截图仅在本机内存处理。`--show-url` 会把完整链接显示在本机终端，分享终端记录前请去掉签到链接。二维码必须已经出现在可见画面中，因此直播源和播放器的缓冲延迟仍会影响发现时间。

## 直播扫码页的本机语音提醒

在安装了 `qwen-asr`、PyTorch 和 `av` 的环境中，从仓库根目录启动服务。把扩展 ID 替换为 `edge://extensions` 中的实际安装 ID。

```powershell
python tools/live_asr_bridge.py --model D:\models\Qwen3-ASR-0.6B --extension-id YOUR_EXTENSION_ID
```

在直播扫码页选择共享 Canvas 标签页并勾选共享音频。服务只绑定本机回环地址，并仅接受指定扩展来源。CPU 推理跟不上播放时会跳过繁忙期间完成的音频片段，扫码仍继续工作。

