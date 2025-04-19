// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as say from 'say';
import axios from 'axios';
import * as os from 'os';
// 导入PowerShell模块用于Windows平台
import { PowerShell } from 'node-powershell';

// 用于存储悬浮窗的装饰器类型
let decorationType: vscode.TextEditorDecorationType;
// 用于存储悬浮窗的定时器
let hoverTimer: NodeJS.Timeout | undefined;

// 预处理文本，处理常见编程风格（下划线、驼峰命名等）
function preprocessText(text: string, forReading: boolean = false): string {
  // 处理下划线分隔的单词 (snake_case)
  let processed = text.replace(/_/g, ' ');
  
  // 处理驼峰命名法 (camelCase 和 PascalCase)
  processed = processed.replace(/([a-z])([A-Z])/g, '$1 $2');
  
  // 处理全大写字母与其他字母之间的过渡 (如 APIVersion 变成 API Version)
  processed = processed.replace(/([A-Z]{2,})([A-Z][a-z])/g, '$1 $2');
  
  // 移除多余的空格
  processed = processed.replace(/\s+/g, ' ').trim();
  
  return processed;
}

// 翻译接口函数
async function translateText(text: string, targetLang: string): Promise<string> {
  try {
    // 预处理文本，将编程风格的标识符转换为更自然的文本
    const processedText = preprocessText(text);
    
    // 使用 Libre Translate API (可以替换为其他开放的翻译API)
    const response = await axios.get('https://translate.googleapis.com/translate_a/single', {
      params: {
        client: 'gtx',
        sl: 'auto', // 自动检测源语言
        tl: targetLang,
        dt: 't',
        q: processedText
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36'
      }
    });

    if (response.data && Array.isArray(response.data[0])) {
      // 提取翻译结果
      let translatedText = '';
      response.data[0].forEach((item: any) => {
        if (item[0]) {
          translatedText += item[0];
        }
      });
      return translatedText;
    }
    throw new Error('翻译结果格式不正确');
  } catch (error) {
    console.error('翻译出错:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`翻译服务错误 (${error.response.status}): ${error.response.statusText}`);
    } else {
      throw new Error('翻译服务出错，请稍后再试');
    }
  }
}

// Windows平台专用的朗读函数
async function readTextWithPowerShell(text: string, speed: number): Promise<void> {
  try {
    // 创建一个新的PowerShell实例，不使用任何可能引起类型错误的选项
    const ps = new PowerShell();

    // 预处理文本，改善朗读效果
    const processedText = preprocessText(text, true);
    
    // PowerShell命令，使用Windows内置的System.Speech.Synthesis
    const speedValue = Math.round((speed - 1) * 10); // 转换速度为Windows的速度范围（-10到10）
    const escapedText = processedText.replace(/"/g, '`"'); // 转义双引号

    const command = `
      Add-Type -AssemblyName System.Speech
      $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
      $synth.Rate = ${speedValue}
      $synth.Speak("${escapedText}")
      $synth.Dispose()
    `;

    await ps.invoke(command);
    await ps.dispose();
    return Promise.resolve();
  } catch (error) {
    console.error('Windows朗读错误:', error);
    throw new Error('Windows朗读服务出错，请确保您有权限执行PowerShell命令或已安装System.Speech组件');
  }
}

// 朗读文本函数
async function readText(text: string, speed: number): Promise<void> {
  // 检查操作系统并使用适当的朗读方法
  const platform = os.platform();
  
  if (platform === 'win32') {
    // 在Windows上使用PowerShell方法
    console.log('在Windows上使用PowerShell进行朗读');
    return readTextWithPowerShell(text, speed);
  } else {
    // 在其他平台上使用say库
    return new Promise((resolve, reject) => {
      try {
        // 预处理文本，改善朗读效果
        const processedText = preprocessText(text, true);
        
        // 使用系统默认语音朗读文本
        say.speak(processedText, undefined, speed, (err) => {
          if (err) {
            console.error('朗读错误:', err);
            reject(err);
            return;
          }
          resolve();
        });
      } catch (error) {
        console.error('朗读出错:', error);
        const detailedError = platform === 'darwin'
          ? '朗读服务出错，请确保macOS已启用语音功能'
          : platform === 'linux'
          ? '朗读服务出错，请确保已安装festival或espeak'
          : '朗读服务出错，请检查系统语音设置';
        reject(new Error(detailedError));
      }
    });
  }
}

// 获取当前选中的文本
function getSelectedText(): { text: string; selection: vscode.Selection } | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }
  
  const selection = editor.selection;
  if (selection.isEmpty) {
    return undefined;
  }
  
  return { 
    text: editor.document.getText(selection),
    selection
  };
}

// 创建悬浮窗口显示翻译结果
function showTranslationHover(
  editor: vscode.TextEditor, 
  selection: vscode.Selection, 
  originalText: string, 
  translatedText: string
) {
  // 清除旧的装饰器
  if (decorationType) {
    decorationType.dispose();
  }
  
  // 清除旧的定时器
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = undefined;
  }
  
  // 获取配置
  const config = vscode.workspace.getConfiguration('codeTranslateReader');
  const showOriginalText = config.get<boolean>('showOriginalText', true);
  const hoverDuration = config.get<number>('hoverDuration', 5000);
  
  // 构建悬浮框内容
  const markdownContent = new vscode.MarkdownString();
  markdownContent.isTrusted = true; // 允许使用更多Markdown特性
  
  if (showOriginalText) {
    markdownContent.appendMarkdown(`**原文:** ${originalText}\n\n`);
  }
  markdownContent.appendMarkdown(`**翻译:** ${translatedText}`);

  // 使用inlineValues装饰而不是hover，这样可以直接在文本旁边显示翻译结果
  decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      contentText: '🔍 ' + (showOriginalText ? originalText + ' → ' : '') + translatedText,
      color: new vscode.ThemeColor('editorCodeLens.foreground'),
      fontStyle: 'italic',
      margin: '0 0 0 1em',
      backgroundColor: new vscode.ThemeColor('editor.hoverHighlightBackground'),
      border: '1px solid',
      borderColor: new vscode.ThemeColor('editor.selectionHighlightBorder'),
      // 移除了不支持的borderRadius属性
      padding: '0 4px'
    },
    backgroundColor: new vscode.ThemeColor('editor.selectionBackground'),
    borderColor: new vscode.ThemeColor('editor.selectionHighlightBorder'),
    border: '1px solid'
  });
  
  // 应用装饰器到选中的文本，直接在文本后展示翻译结果
  editor.setDecorations(decorationType, [selection]);
  
  // 创建一个状态栏项，作为替代显示方式
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = `$(globe) ${translatedText}`;
  statusBarItem.tooltip = showOriginalText ? `原文: ${originalText}\n翻译: ${translatedText}` : translatedText;
  statusBarItem.show();
  
  // 设置定时器，在一段时间后自动关闭装饰器和状态栏项
  if (hoverDuration > 0) {
    hoverTimer = setTimeout(() => {
      if (decorationType) {
        decorationType.dispose();
      }
      statusBarItem.dispose();
    }, hoverDuration);
  }
}

// 显示状态栏消息
function showStatusBarMessage(message: string, timeout: number = 3000) {
  return vscode.window.setStatusBarMessage(message, timeout);
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('插件 "代码翻译与朗读助手" 已激活!');

  // 注册翻译命令
  const translateDisposable = vscode.commands.registerCommand(
    'code-translate-reader.translateSelection',
    async () => {
      const selectedInfo = getSelectedText();
      if (!selectedInfo) {
        vscode.window.showWarningMessage('请先选择要翻译的文本');
        return;
      }

      const { text: selectedText, selection } = selectedInfo;
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      try {
        // 获取配置的目标语言
        const config = vscode.workspace.getConfiguration('codeTranslateReader');
        const targetLang = config.get<string>('targetLanguage', 'zh-CN');

        // 显示状态栏加载消息
        const statusBarMessage = showStatusBarMessage('$(sync~spin) 正在翻译...');
        
        try {
          const translatedText = await translateText(selectedText, targetLang);
          
          // 在悬浮窗中显示翻译结果
          showTranslationHover(editor, selection, selectedText, translatedText);
          
          // 更新状态栏
          statusBarMessage.dispose();
          showStatusBarMessage('$(check) 翻译完成');
          
          return translatedText;
        } catch (error) {
          statusBarMessage.dispose();
          vscode.window.showErrorMessage(`翻译失败: ${error instanceof Error ? error.message : String(error)}`);
          throw error;
        }
      } catch (error) {
        vscode.window.showErrorMessage(`翻译出错: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // 注册朗读命令
  const readDisposable = vscode.commands.registerCommand(
    'code-translate-reader.readSelection',
    async () => {
      const selectedInfo = getSelectedText();
      if (!selectedInfo) {
        vscode.window.showWarningMessage('请先选择要朗读的文本');
        return;
      }

      const { text: selectedText } = selectedInfo;

      try {
        // 获取配置的朗读速度
        const config = vscode.workspace.getConfiguration('codeTranslateReader');
        const voiceSpeed = config.get<number>('voiceSpeed', 1.0);

        // 显示状态栏消息
        const statusMessage = showStatusBarMessage(`$(megaphone) 正在朗读...`);
        
        try {
          await readText(selectedText, voiceSpeed);
          statusMessage.dispose();
          showStatusBarMessage('$(check) 朗读完成');
        } catch (error) {
          statusMessage.dispose();
          vscode.window.showErrorMessage(`朗读出错: ${error instanceof Error ? error.message : String(error)}`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`朗读出错: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // 将命令注册到上下文中
  context.subscriptions.push(translateDisposable);
  context.subscriptions.push(readDisposable);
  
  // 确保在插件停用时清理资源
  context.subscriptions.push({
    dispose: () => {
      if (decorationType) {
        decorationType.dispose();
      }
      if (hoverTimer) {
        clearTimeout(hoverTimer);
      }
    }
  });
}

// This method is called when your extension is deactivated
export function deactivate() {
  // 停止所有正在进行的朗读
  say.stop();
  
  // 清理资源
  if (decorationType) {
    decorationType.dispose();
  }
  if (hoverTimer) {
    clearTimeout(hoverTimer);
  }
}
