# SJTU Canvas 签到提醒

来源：https://github.com/IcekyPrime/SJTU_SignIn_Monitor
保留上游历史；原文档见 Readme.md。

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
