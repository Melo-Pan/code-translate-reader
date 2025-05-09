# 代码翻译与朗读助手 (Code Translate Reader)

这个VSCode插件为开发者提供了代码和文本的翻译与朗读功能，特别适合非英语母语的开发者理解代码中的专有名词和英文注释。

![代码翻译与朗读助手演示](https://raw.githubusercontent.com/Melo-Pan/code-translate-reader/main/image.png)

## 功能特点

### 1. 代码翻译
选中任何文本，快速获取翻译结果：
- 自动处理代码中常见的命名风格（驼峰命名法、下划线分隔等）
- 翻译结果直接显示在代码旁边，无需弹窗打断工作流
- 支持多种翻译服务提供商，适应不同网络环境

### 2. 文本朗读
选中任何文本，一键朗读，帮助理解正确的发音：
- 支持Windows、macOS和Linux平台
- 智能处理代码中的特殊标识符（如下划线、驼峰命名）
- 可调节朗读速度

## 使用方法

### 翻译文本
1. 选择需要翻译的文本
2. 使用以下方法之一触发翻译：
   - 快捷键：`Ctrl+Shift+T`（Mac上是`Cmd+Shift+T`）
   - 右键菜单：选择"翻译选中文本"

### 朗读文本
1. 选择需要朗读的文本
2. 使用以下方法之一触发朗读：
   - 快捷键：`Ctrl+Shift+R`（Mac上是`Cmd+Shift+R`）
   - 右键菜单：选择"朗读选中文本"

## 配置说明

### 翻译服务配置

插件支持三种翻译服务：

1. **Google翻译**（默认）
   - 全球可用，但在中国大陆可能访问受限
   - 无需API密钥

2. **百度翻译**
   - 中国网络环境友好
   - 需要百度翻译API的AppID和密钥
   ```
   "codeTranslateReader.translationService": "baidu",
   "codeTranslateReader.baiduAppId": "你的AppID",
   "codeTranslateReader.baiduAppSecret": "你的密钥"
   ```
   - [百度翻译开放平台](http://api.fanyi.baidu.com/)申请方法：
     1. 注册并创建应用（建议选择"标准版"）
     2. 获取AppID和密钥
     3. 在VSCode设置中填入

3. **有道翻译**
   - 中国网络环境友好
   - 需要有道智云API的应用ID和密钥
   ```
   "codeTranslateReader.translationService": "youdao",
   "codeTranslateReader.youdaoAppKey": "你的应用ID",
   "codeTranslateReader.youdaoAppSecret": "你的应用密钥"
   ```
   - [有道智云平台](https://ai.youdao.com/)申请方法：
     1. 注册并创建应用（自然语言翻译服务）
     2. 获取应用ID和密钥
     3. 在VSCode设置中填入

### 朗读功能平台要求

不同平台需要满足以下条件才能使用朗读功能：

#### Windows
- 已安装语音包（控制面板 → 语音识别 → 文本到语音选项）
- 使用Windows内置的System.Speech服务

#### macOS
- 系统已启用语音功能（系统设置 → 辅助功能 → 语音）
- 使用系统内置的'say'命令

#### Linux
- 需安装以下工具之一：
  - Festival: `sudo apt-get install festival`（Debian/Ubuntu）
  - eSpeak: `sudo apt-get install espeak`（Debian/Ubuntu）

### 其他设置

| 设置项 | 说明 |
|-------|------|
| `codeTranslateReader.targetLanguage` | 目标语言（如zh-CN、en、ja等） |
| `codeTranslateReader.voiceSpeed` | 朗读速度（0.5-2.0之间的数值） |
| `codeTranslateReader.showOriginalText` | 是否在翻译结果中显示原文 |
| `codeTranslateReader.hoverDuration` | 翻译结果显示时间（毫秒） |

## 故障排除

### 翻译问题
- 如使用Google翻译，请确保网络可访问Google服务
- 如使用百度或有道翻译，请确认API密钥配置正确

### 朗读问题
- Windows平台：检查文本到语音设置和PowerShell执行权限
- macOS平台：确保系统语音功能已启用
- Linux平台：确认已安装festival或espeak

## 许可证

MIT
