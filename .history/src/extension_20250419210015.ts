// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as say from 'say';
import axios from 'axios';
import * as translator from 'node-google-translate-free';

// 翻译接口函数
async function translateText(text: string, targetLang: string): Promise<string> {
  try {
    const result = await translator.translate(text, targetLang);
    return result.text;
  } catch (error) {
    console.error('翻译出错:', error);
    throw new Error('翻译服务出错，请稍后再试');
  }
}

// 朗读文本函数
function readText(text: string, speed: number): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // 使用系统默认语音朗读文本
      say.speak(text, undefined, speed, (err) => {
        if (err) {
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
