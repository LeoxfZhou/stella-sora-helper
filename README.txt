Stella Sora Helper / 星塔旅人助手 · 浏览器版

派遣任务、培养方案及按旅人/队伍查看的中英文纹章推荐。访问部署后的网址即可使用，无需安装或登录。

个人存档
拥有状态、等级与语言保存在当前浏览器的网站存储中，不上传到服务器。换浏览器、换设备或更换网站地址后不会自动同步。清除网站数据会删除存档，请使用“数据设置 → 导出存档”备份。导入将替换此浏览器的配置。
网站首次使用默认为未拥有、1级，不能把个人存档加入公开仓库。

维护者本地构建（普通玩家不需要）
依赖 Python 3、Node.js（测试）；不需要 C++ 服务。
python3 tools/build_web.py
node tests/browser_tests.js
node tests/stella_emblems_tests.js
node tests/trekker_sort_tests.js
python3 -m http.server 8765 --bind 127.0.0.1 --directory dist
浏览器访问 http://127.0.0.1:8765/ 。不要双击 index.html 以 file:// 方式使用。

GitHub Pages
将本公开副本作为仓库根目录上传到 main，仓库 Settings → Pages → Source 选择 GitHub Actions。
工作流会构建和检查，只部署 dist，不部署本地存档、缓存或原始攻略。
相对资源路径支持 https://用户名.github.io/仓库名/ 。
官方配置说明：https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

数据库与推荐更新
维护者更新经过核对的公共资料并发布新版本；用户点击“检查网站资料更新”重新加载网站已发布的数据，不覆盖自己的存档。该按钮不直接抓取 B站或 StellaBase。

资料出处与限制
旅人及纹章基础资料参考 StellaBase：https://stella.ennead.cc/ 。
推荐保留对应攻略作者、原文链接及简短整理说明；不包含 B站原文、攻略整图、图片直链、抓取缓存、OCR 或内部核验记录。
“攻略参考”和“机制推导”分别标注；S/A/B/C 为当前固定队伍下的建议，不是精确伤害模拟。攻略可能过时，不保证全局最优。
派遣沿用原版的有限候选与搜索宽度，不是穷举最优证明。
本项目是非官方工具，游戏名称、立绘等第三方内容不因本项目公开而获得新的授权；引用来源不代表取得转载许可。

维护者保留的完整攻略核验材料与个人迁移文件不属于本公开副本。
