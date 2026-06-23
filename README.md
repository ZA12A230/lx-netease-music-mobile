<p align="center"><a href="https://github.com/ZA12A230/lx-netease-music-mobile"><img width="200" src="https://github.com/lyswhut/lx-music-mobile/blob/master/doc/images/icon.png" alt="lx-music logo"></a></p>

<h1 align="center">LX-N Music 移动版</h1>

<p align="center">
  <a href="https://github.com/ZA12A230/lx-netease-music-mobile/releases"><img src="https://img.shields.io/github/release/ZA12A230/lx-netease-music-mobile" alt="Release version"></a>
  <a href="https://github.com/ZA12A230/lx-netease-music-mobile/actions/workflows/build-apk.yml"><img src="https://github.com/ZA12A230/lx-netease-music-mobile/actions/workflows/build-apk.yml/badge.svg" alt="Build status"></a>
  <a href="https://github.com/facebook/react-native"><img src="https://img.shields.io/github/package-json/dependency-version/ZA12A230/lx-netease-music-mobile/react-native/master" alt="React native version"></a>
</p>

<p align="center">一个基于 React Native 开发的音乐软件 | 开发者：G佑</p>

这个库在lx-music-mobile和ikun-music基础上继续改造，以满足个人需求
- https://github.com/lyswhut/lx-music-mobile
- https://github.com/ikunshare/ikun-music-mobile

涉及同步、备份未充分测试，自行备份重要文件

## 下载安装
前往 [Releases 页面](https://github.com/ZA12A230/lx-netease-music-mobile/releases) 下载最新 APK 安装即可。

### 1.8.86（G佑 二次开发版）
#### 新增功能
- **内置音源**：5 个音源自动导入（野草、六音、小熊猫、梓澄、Huibq），无需手动配置
- **iOS 26 液态玻璃风格**：全局按键采用毛玻璃模糊 + 半透明 + 柔和阴影 + 圆角设计
- **AI 助手功能**：
  - 内置 3 个科大讯飞 AI（Spark Ultra-32K、Spark X X2、Spark X X1.5），开箱即用
  - 支持 9+ 主流 AI 平台：Kimi、通义千问、DeepSeek、OpenAI、Claude、豆包、Gemini、智谱
  - AI 全自动操控软件：搜索歌曲/专辑/歌手/歌词、播放/暂停/上一首/下一首/快进快退、一键下载、导航页面、设置音量、添加到我喜欢
  - 一句话全自动操控：用户只需说一句话，AI 自动执行所有操作
  - AI 聊天功能：支持自然语言对话
  - 歌词总结功能
  - 10 次免费对话（全局共享，不分 AI 模型），超出自动锁死，需管理员密码授权
  - 所有 API 密钥和管理员密码加密存储，不可破译
  - AI 入口：首页顶部 + 侧边菜单
- **仓库迁移**：所有链接已更新至 `https://github.com/ZA12A230/lx-netease-music-mobile`
- **开发者**：G佑
#### 云构建
- 支持 GitHub Actions 自动构建 APK 并发布 Release
---
### 1.8.85
#### 修复、优化
- 同步上游代码
- 歌手、专辑详情预览显示图片
- webdav会同步播放、下载历史了，移除cookie、密码敏感信息
- wy版权歌曲播放的官方替代
#### 新增
- 播放历史（播放2分钟/50%计入历史）
- 相似歌手、歌曲
- 全量导出备份
- OneDrive远程播放
- wy搜索增强（需要申请apikey，免费250次/月，通过谷歌搜索来补充搜索接口搜不到的歌曲）
---
### 1.8.83
#### 修复、优化
- wy登录页采用手机端
- 通知栏优化
- 修复播放、下载速度异常
- 其他一些小问题
---
### 1.8.81
#### 修复、优化
- 音质标签颜色固定
- 桌面歌词解锁状态点击会显示锁定图标
- 通知栏的专辑名称显示、标题显示修正
- 歌词详情可手势改变字体大小，迷你歌词固定大小
- 歌曲打点实时判断
- 菜单图标修正、删除了几个无用设置
- 修复日推歌曲数量异常
- 取消过滤推荐歌单里的私人雷达
#### 新增
- 通知栏桌面歌词显隐按钮
- 桌面组件
- 风格化推荐
- 心动模式（两个入口，模式切换或我喜欢的歌曲右边按钮）
- 发送评论
---
### 1.8.78
#### 修复、优化
- wy部分歌曲搜索不到的问题（拉取原仓库）
- 图片组件优化、启动app初始化最后播放的歌曲到通知栏（拉取原仓库）
- webdav同步增加两个手动同步歌单按钮，增加判断（未充分测试）
- wy的vip信息未持久保存的问题（会导致重启app后无法播放vip歌曲、下载高音质歌曲）
#### 新增
- 长按封面可下载封面
- gitcode、几个车机设置项恢复
- 通知栏、播放详情显示专辑名称
---
### 1.8.77
#### 修复
- 几个小问题
---
### 1.8.76
#### 新增
- 多选模式的在线歌单操作
- 长按底部播放栏的跳转，现在可以跳转到对应页面了
#### 修复、优化
- 下载地址获取成功的提示增加
- 移除下载任务会终止下载并移除下载中的文件
---
### 1.8.75
#### 修复、优化
- 解决歌单详情的背景问题
- 日推缓存增加
---
### 1.8.74
#### 修复、优化
- 修复横屏下菜单、详情的展示
- 修复一个多页面嵌套问题
- 播放url增加wy vip判断
---
### 1.8.73
#### 修复、优化
- cookie获取vip歌曲url直接返回而不是重试
- 略微增加详情的封面大小
---
### 1.8.72
#### 新增
- 我的wy歌单操作增加（新建、编辑可能有问题）
- wy MV播放
- 更多菜单的显隐
- 下载元信息别名设置
#### 修复、优化
- 打点触发，修改为播放2分钟或50%以上
---
### 1.8.70

#### 新增
- 搜索类型：歌手、专辑，仅支持wy源
- wy歌曲听歌打点：以助于个性化推荐
- 日推：歌单增加，相似歌曲增加，入口在日推底部
- 批量下载：仅支持wy cookie
- wy源翻唱cover标识增加

#### 优化
- 底部播放器，上滑可以打开当前播放列表，左右滑可以打开菜单，顶部增加一个进度条
- 现在我的歌单里面封面序号显示可切换
- 播放详情顶部歌手可点击跳到歌手详情、底部更多按钮添加
- 统一我关注的歌手、收藏的专辑、歌单的展示效果
- 歌手详情内部专辑列表可以切换网格、列表显示
---
### 1.8.60
- webdav支持（歌单支持自动同步，设置和音源手动同步）
- 下载管理器
- 顶部滑动可以弹出菜单抽屉
---
### 1.8.60以下版本
  #### 新增（仅支持wy）
  - 菜单增加：每日推荐
  - 菜单增加：我的歌单
  - 菜单增加：我关注的歌手
  - 菜单增加：我收藏的专辑
  - 歌曲下拉菜单增加：歌手详情
  - 歌曲下拉菜单增加：专辑详情
  - 收藏歌曲/歌手/专辑
  - 歌曲列表显示歌曲封面
  - 歌曲列表显示歌曲别名
  - 歌曲列表显示VIP标签
  - 自动保存日推歌单(最多15个，多的会自动删除)
  #### 其他
  - 全局顶部搜索栏增加
  - 播放详情内迷你歌词显示
  - 播放详情内可设置圆形旋转封面
  - 播放详情内歌词点击即可跳转，替换原有的跳转方式
  - 播放详情顶部的名称过长滚动显示
  - 底部播放器删除时间条及点击跳转
  - 底部播放器增加按钮，点击显示当前播放列表
  - 背景模糊度、背景图片设置
  - 左侧菜单可设置显示/隐藏
  - 退出程序的二次确认
  - 默认设置值修改
