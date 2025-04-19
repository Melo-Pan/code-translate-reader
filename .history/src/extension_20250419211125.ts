// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as say from 'say';
import axios from 'axios';

// 翻译接口函数
async function translateText(text: string, targetLang: string): Promise<string> {
  try {
    // 使用 Libre Translate API (可以替换为其他开放的翻译API)
    const response = await axios.get('https://translate.googleapis.com/translate_a/single', {
      params: {
        client: 'gtx',
        sl: 'auto', // 自动检测源语言
        tl: targetLang,
        dt: 't',
        q: text
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

// 朗读文本函数
function readText(text: string, speed: number): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // 检查系统是否支持文本到语音转换
      if (!say.isInstalled()) {
        throw new Error('系统不支持文本到语音转换，请安装相关组件');
      }
      
      // 使用系统默认语音朗读文本
      say.speak(text, undefined, speed, (err) => {
        if (err) {
          console.error('朗读错误:', err);
          reject(err);
          return;
        }
        resolve();
      });
    } catch (error) {
      console.error('朗读出错:', error);
      reject(new Error('朗读服务出错，请检查系统语音设置'));
    }
  });
}

// 获取当前选中的文本
function getSelectedText(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }
  
  const selection = editor.selection;
  if (selection.isEmpty) {
    return undefined;
  }
  
  return editor.document.getText(selection);
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('插件 "代码翻译与朗读助手" 已激活!');

  // 注册翻译命令
  const translateDisposable = vscode.commands.registerCommand(
    'code-translate-reader.translateSelection',
    async () => {
      const selectedText = getSelectedText();
      if (!selectedText) {
        vscode.window.showWarningMessage('请先选择要翻译的文本');
        return;
      }

      try {
        // 获取配置的目标语言
        const config = vscode.workspace.getConfiguration('codeTranslateReader');
        const targetLang = config.get<string>('targetLanguage', 'zh-CN');

        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "正在翻译...",
          cancellable: false
        }, async (progress) => {
          progress.report({ increment: 50 });
          
          try {
            const translatedText = await translateText(selectedText, targetLang);
            
            // 显示翻译结果
            const resultMessage = `原文: ${selectedText}\n翻译: ${translatedText}`;
            vscode.window.showInformationMessage(resultMessage, { modal: true });
            
            progress.report({ increment: 50 });
            return translatedText;
          } catch (error) {
            vscode.window.showErrorMessage(`翻译失败: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
          }
        });
      } catch (error) {
        vscode.window.showErrorMessage(`翻译出错: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // 注册朗读命令
  const readDisposable = vscode.commands.registerCommand(
    'code-translate-reader.readSelection',
    async () => {
      const selectedText = getSelectedText();
      if (!selectedText) {
        vscode.window.showWarningMessage('请先选择要朗读的文本');
        return;
      }

      try {
        // 获取配置的朗读速度
        const config = vscode.workspace.getConfiguration('codeTranslateReader');
        const voiceSpeed = config.get<number>('voiceSpeed', 1.0);

        vscode.window.showInformationMessage(`正在朗读: "${selectedText.substring(0, 30)}${selectedText.length > 30 ? '...' : ''}"`);
        await readText(selectedText, voiceSpeed);
      } catch (error) {
        vscode.window.showErrorMessage(`朗读出错: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // 将命令注册到上下文中
  context.subscriptions.push(translateDisposable);
  context.subscriptions.push(readDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {
  // 停止所有正在进行的朗读
  say.stop();
}
