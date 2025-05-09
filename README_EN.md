# Code Translate Reader

A VSCode extension that provides code translation and text-to-speech functionality, especially helpful for non-native English speakers to understand technical terms and comments in code.

[中文文档](README.md)

![Code Translate Reader Demo](https://raw.githubusercontent.com/Melo-Pan/code-translate-reader/main/image.png)

## Features

### 1. Code Translation
Select any text to get instant translations:
- Automatically handles common coding styles (camelCase, snake_case, etc.)
- Translation results display directly next to your code without popups
- Supports multiple translation services for different network environments

### 2. Text-to-Speech
Select any text and have it read aloud to understand proper pronunciation:
- Supports Windows, macOS, and Linux platforms
- Intelligently processes special identifiers in code
- Adjustable speech speed

## How to Use

### Translate Text
1. Select the text you want to translate
2. Trigger translation using one of these methods:
   - Shortcut: `Ctrl+Shift+T` (or `Cmd+Shift+T` on Mac)
   - Context menu: Select "Translate Selected Text"

### Read Text Aloud
1. Select the text you want to hear
2. Trigger speech using one of these methods:
   - Shortcut: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
   - Context menu: Select "Read Selected Text"

## Configuration

### Translation Services

The extension supports three translation services:

1. **Google Translate** (default)
   - Globally accessible, but may be restricted in mainland China
   - No API key required

2. **Baidu Translate**
   - Works well in China
   - Requires Baidu Translate API's AppID and Secret
   ```
   "codeTranslateReader.translationService": "baidu",
   "codeTranslateReader.baiduAppId": "your AppID",
   "codeTranslateReader.baiduAppSecret": "your Secret"
   ```
   - How to apply from [Baidu Translation Platform](http://api.fanyi.baidu.com/):
     1. Register and create an application (Standard version recommended)
     2. Get your AppID and Secret
     3. Enter them in VSCode settings

3. **Youdao Translate**
   - Works well in China
   - Requires Youdao API credentials
   ```
   "codeTranslateReader.translationService": "youdao",
   "codeTranslateReader.youdaoAppKey": "your App Key",
   "codeTranslateReader.youdaoAppSecret": "your App Secret"
   ```
   - How to apply from [Youdao AI Cloud](https://ai.youdao.com/):
     1. Register and create an application (Natural Language Translation)
     2. Get your App Key and App Secret
     3. Enter them in VSCode settings

### Text-to-Speech Requirements

Different platforms require specific configurations for the speech function:

#### Windows
- Install voice packages (Control Panel → Speech Recognition → Text-to-Speech options)
- Uses Windows built-in System.Speech service

#### macOS
- Enable speech functionality (System Settings → Accessibility → Speech)
- Uses the built-in 'say' command

#### Linux
- Install one of these tools:
  - Festival: `sudo apt-get install festival` (Debian/Ubuntu)
  - eSpeak: `sudo apt-get install espeak` (Debian/Ubuntu)

### Other Settings

| Setting | Description |
|---------|-------------|
| `codeTranslateReader.targetLanguage` | Target language (e.g., zh-CN, en, ja, etc.) |
| `codeTranslateReader.voiceSpeed` | Speech speed (value between 0.5-2.0) |
| `codeTranslateReader.showOriginalText` | Whether to show original text in translation results |
| `codeTranslateReader.hoverDuration` | Duration to display translation results (milliseconds) |

## Troubleshooting

### Translation Issues
- If using Google Translate, ensure your network can access Google services
- If using Baidu or Youdao, verify your API credentials are correctly configured

### Speech Issues
- Windows: Check text-to-speech settings and PowerShell execution permissions
- macOS: Make sure system speech functionality is enabled
- Linux: Verify that festival or espeak is installed

## License

MIT