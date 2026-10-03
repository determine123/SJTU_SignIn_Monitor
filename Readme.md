# SJTU Canvas 签到提醒

来源：https://github.com/IcekyPrime/SJTU_SignIn_Monitor
保留上游历史；原文档见 Readme.md。

推荐使用 edge-signin-monitor：在 edge://extensions 开启开发人员模式，加载该目录。每次 Edge 启动后点击图标才开始工作。自行填写课程编号及课表，支持课前30分钟、桌面、声音与可选手机提醒。无内置个人课表、推送密钥或登录资料。

Python 版：pip install -r requirements-lock.txt。将示例配置复制到 data/signin-notifications.json 并填写自己的推送参数。需自行准备 browser/chrome-win64/chrome.exe 与 browser/chromedriver-win64/chromedriver.exe（匹配版本），按原说明运行。登录由使用者手动完成。数据和登录状态保存在被 Git 忽略的 data/ 与 profiles/。

不会自动签到；需要浏览器运行且电脑不休眠，手机推送取决于服务权限与送达情况。
