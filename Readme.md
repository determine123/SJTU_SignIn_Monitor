# SJTU Canvas 签到提醒

来源：https://github.com/IcekyPrime/SJTU_SignIn_Monitor
保留上游历史；原文档见 Readme.md。

推荐使用 edge-signin-monitor：在 edge://extensions 开启开发人员模式，加载该目录。每次 Edge 启动后点击图标才开始工作。自行填写课程编号及课表，支持课前30分钟、桌面、声音与可选手机提醒。无内置个人课表、推送密钥或登录资料。

Python 版：pip install -r requirements-lock.txt。将示例配置复制到 data/signin-notifications.json 并填写自己的推送参数。优先复用 browser/ 中自行准备的匹配 Chrome 与驱动；未提供时由 Selenium Manager 使用本机 Chrome。可用 CHROME_BINARY 指定浏览器可执行文件，按原说明运行。登录由使用者手动完成。数据和登录状态保存在被 Git 忽略的 data/ 与 profiles/。

不会自动签到；需要浏览器运行且电脑不休眠，手机推送取决于服务权限与送达情况。


## 原仓库与来源

本仓库基于 [IcekyPrime/SJTU_SignIn_Monitor](https://github.com/IcekyPrime/SJTU_SignIn_Monitor)，保留原项目提交历史。本账号提供本地部署改进及 Edge 扩展；原作者与本地修改的来源分别注明，使用时遵守上游许可及平台规则。
