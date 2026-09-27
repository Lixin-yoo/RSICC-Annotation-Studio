# RSICC Annotation Studio

基于原 Flask 标注系统改造的 Windows 本地离线标注工具。保留原有双时相影像、掩膜和五条描述工作流，JSON 与原格式兼容。

## Windows 使用

1. 解压 `RSICCStudio-Windows-x64.zip`，保留整个目录，双击 `RSICCStudio.exe`。不要只复制 exe；同目录 `_internal` 包含运行时和静态资源。
2. 启动器会打开系统默认浏览器，地址为随机本机端口 `http://127.0.0.1:...`。程序不需要联网，不需要安装 Python。建议使用 Windows 10/11 上的现代 Edge 或 Chrome。
3. 首次运行进入设置。数据集目录选择含 `train`、`val`、`test` 的根目录；保存目录建议选择一个新的空目录。不要直接指向唯一的原始标注目录。
4. 如有旧 JSON，点击“导入标注”，选择文件。程序将验证并复制到工作区，不改写导入来源；已有记录的工作区拒绝覆盖导入。
5. 从左侧任务列表选择样本。在中间对比 A/B/掩膜，在右侧选择场景、变化标志并编辑五条描述。滚轮缩放、拖动平移；支持同步定位。
6. 自动保存保留恢复草稿。完成后“检查并保存”才写入正式 JSON。关闭浏览器不会关闭服务；结束时通过启动器“关闭服务并退出”。
7. 点击“导出”，文件写入工作区的 `exports` 目录，每次使用独立文件名，不覆盖历史导出。

## 数据目录

```text
dataset/
  train/
    A/example.png
    B/example.png
    label/example.png
  val/ ...
  test/ ...
```

至少一个划分必须存在。配对依据是同一划分下的相同文件名，不按排序位置配对；缺少任何一幅图像会明确标记，不能正式保存。支持 PNG/JPEG/TIFF/BMP 中的 8 位 RGB、RGBA、灰度或调色板图。16 位或多光谱原始数据请先准备目视解译用的可视化影像；不静默拉伸或改变原文件。

“添加影像对”要求三幅影像同尺寸，保存为 PNG，拒绝覆盖同名文件。掩膜不再被隐式阈值化。正常浏览/标注不改写任何原始影像。

## 标注格式与状态

正式文件为 `annotations.json`，根对象是 `{"images": [...]}`。每条记录保留 `filepath`、`filename`、`imgid`、`split`、`changeflag`、`sentences`、`sentids`；每条句子保留 `tokens`、`raw`、`imgid`、`sentid`。更新已有记录时保留 ID；新记录从现有最大 ID 之后分配。未经编辑的 raw、tokens 和附加字段原样保留；修改后的 raw 保留输入大小写，tokens 按小写空白分词，不自动追加句号。

- 未标注：没有正式记录，也没有草稿。
- 已保存：正式记录的五条描述通过非空、重复项检查，且无编号异常。
- 待检查：存在恢复草稿，或导入内容有空/重复描述、历史编号异常。
- 已核对：用户勾选核对后保存，记录仍通过上述检查。

“已保存”计数不包含待检查记录；导入的待检查记录仍在 JSON 中，不会被删除。导出包含所有正式记录，并提示未导出的草稿数和历史编号异常数。此工具不自动判断语义正确性。

CSV 为逐句表，含 filepath、filename、imgid、split、changeflag、sentid、raw，不含 tokens 或附加字段，不用于无损回导。为防止电子表格公式执行，危险前缀仅在 CSV 输出中加单引号，JSON 不变。

## 数据安全与恢复

- JSON 使用同目录临时文件、flush/fsync 和原子替换；读取失败不会用空数据覆盖原文件。
- 工作区 `recovery.sqlite3` 保存自动草稿、场景、核对状态及历史版本。退出后重新启动可恢复已写入的草稿；间隔内尚未持久化的编辑无法保证恢复。切换样本前立即保存草稿，失败则阻止切换。
- 修改正式记录前备份完整 JSON，`backups` 保留最近 30 份；“版本历史”可恢复单条记录为草稿，再次保存才生效。
- 同一工作区加 Windows 文件锁；检测 JSON 被外部修改后拒绝覆盖，需关闭并重新打开。属于单机单写入者模式，不支持多人同时写同一网络盘目录。
- 迁移工作区时关闭程序，复制整个保存目录（包括 SQLite 及可能存在的 WAL/SHM），再在设置中选择新路径。只搬 JSON 会丢失草稿、历史和检查状态，但正式标注仍可读取。
- 设置与日志默认放在 `%LOCALAPPDATA%\RSICCAnnotationStudio`，不写入 exe 安装目录。

导入旧文件时不静默修复编号。设置中的“修复重复句子编号”需要明确确认：保持 imgid；首次出现的 sentid 不变，仅为重复出现的句子分配新 ID，并同步 sentids。先备份，编号映射写入独立 `id-repair-*.json`。有草稿时阻止修复，避免版本冲突。操作不可通过普通文本撤销；可在关闭程序后从完整备份恢复。

## 快捷键

| 快捷键 | 操作 |
|---|---|
| Ctrl+S | 检查并正式保存 |
| Ctrl+Enter | 保存后下一条 |
| Alt+左/右 | 上一条/下一条 |
| Ctrl+Z / Ctrl+Y | 文本输入撤销/重做 |
| F | 适应窗口（输入框内不触发） |
| 滚轮 / 拖动 | 缩放 / 平移 |

主题、字号、自动保存间隔、时相标题、同步显示、掩膜显示和导出格式均可在设置中保存。使用系统字体 Segoe UI / Microsoft YaHei UI / Arial，不依赖外部字体下载。

## 开发与重新打包

在 Windows x64、Python 3.13 环境下：

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.venv\Scripts\python.exe launcher.py
.venv\Scripts\python.exe -m pytest tests/test_core.py -q
.venv\Scripts\python.exe build.py
```

产物：`dist\RSICCStudio\RSICCStudio.exe` 和 `_internal`。`build.py` 生成图标，再调用 PyInstaller 配置文件。开发/测试环境需要联网安装依赖；运行产物不需要网络或 Python。

自动化浏览器测试：

```powershell
.venv\Scripts\python.exe tests/ui_smoke.py
.venv\Scripts\python.exe tests/ui_smoke.py --exe dist/RSICCStudio/RSICCStudio.exe
.venv\Scripts\python.exe tests/native_smoke.py
```

界面测试脚本针对本机现有数据路径；迁移开发机器时修改脚本顶部 SOURCE。测试只写独立 `artifacts` 子目录。运行日志、JUnit 报告与截图也保存在 artifacts。

## 项目结构

- `launcher.py`：Windows 启动器、目录选择桥接、本机服务生命周期。
- `studio/server.py`：Flask API、安全检查、配置、影像预览、导入导出。
- `studio/storage.py`：兼容 JSON、草稿数据库、原子保存、备份、版本冲突、编号审计。
- `studio/dataset.py`：后台扫描与按文件名配对。
- `studio/templates`、`studio/static`：无构建步骤的本地工作台及图标。
- `tests`：数据可靠性、源码界面和打包产物测试。
- `legacy`：原启动代码、模板和独立 React 原型的备份，不参与新程序运行。

## 边界与验证范围

Windows 10 x64 当前机器已测试；未在另一台未安装 Python 的实体机器上验证，未进行真实 Windows 系统缩放 125%/150% 的人工测试。浏览器自动化覆盖 150% deviceScaleFactor，不等同于所有系统缩放组合。

本版本采用本机浏览器工作台，不是嵌入 WebView 的单窗口应用。保留 Flask 避免更换技术栈；运行时只监听 127.0.0.1，启用随机会话令牌和来源检查，不用于公网部署。可执行文件未做商业代码签名，Windows SmartScreen 可能提示未知发布者。未实现多人协作、自动语义评价或云端模型调用。
