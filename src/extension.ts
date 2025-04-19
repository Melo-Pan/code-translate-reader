// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as say from 'say';
import axios from 'axios';
import * as os from 'os';
// 导入PowerShell模块用于Windows平台
import { PowerShell } from 'node-powershell';
// 导入加密库用于API签名
import * as CryptoJS from 'crypto-js';

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

// 翻译服务类型
enum TranslationService {
  Google = 'google',
  Baidu = 'baidu',
  Youdao = 'youdao'
}

// 使用Google翻译API
async function translateWithGoogle(text: string, targetLang: string): Promise<string> {
  try {
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
    console.error('Google翻译出错:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Google翻译服务错误 (${error.response.status}): ${error.response.statusText}`);
    } else {
      throw new Error('Google翻译服务出错，请稍后再试或切换其他翻译服务');
    }
  }
}

// 使用百度翻译API
async function translateWithBaidu(text: string, targetLang: string): Promise<string> {
  try {
    const config = vscode.workspace.getConfiguration('codeTranslateReader');
    const appId = config.get<string>('baiduAppId', '');
    const appSecret = config.get<string>('baiduAppSecret', '');
    
    if (!appId || !appSecret) {
      throw new Error('请在设置中配置百度翻译API的AppID和密钥');
    }
    
    // 修正目标语言代码，百度使用的代码与其他服务有所不同
    const langMap: {[key: string]: string} = {
      'zh-CN': 'zh',
      'en-US': 'en',
      'en': 'en',
      'ja': 'jp',
      'ko': 'kor'
    };
    const baiduTargetLang = langMap[targetLang] || targetLang;
    
    // 生成随机数
    const salt = Date.now().toString();
    // 生成签名：appid+q+salt+密钥的MD5值
    const sign = CryptoJS.MD5(appId + text + salt + appSecret).toString();
    
    const response = await axios.get('https://fanyi-api.baidu.com/api/trans/vip/translate', {
      params: {
        q: text,
        from: 'auto',
        to: baiduTargetLang,
        appid: appId,
        salt: salt,
        sign: sign
      }
    });
    
    if (response.data && response.data.trans_result && response.data.trans_result.length > 0) {
      return response.data.trans_result[0].dst;
    }
    
    throw new Error('百度翻译结果格式不正确');
  } catch (error) {
    console.error('百度翻译出错:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`百度翻译服务错误 (${error.response.status}): ${error.response.statusText}`);
    } else if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('百度翻译服务出错，请稍后再试');
    }
  }
}

// 使用有道翻译API
async function translateWithYoudao(text: string, targetLang: string): Promise<string> {
  try {
    const config = vscode.workspace.getConfiguration('codeTranslateReader');
    const appKey = config.get<string>('youdaoAppKey', '');
    const appSecret = config.get<string>('youdaoAppSecret', '');
    
    if (!appKey || !appSecret) {
      throw new Error('请在设置中配置有道翻译API的应用ID和密钥');
    }
    
    // 修正目标语言代码，有道使用的代码与其他服务有所不同
    const langMap: {[key: string]: string} = {
      'zh-CN': 'zh-CHS',
      'en-US': 'en',
      'en': 'en',
      'ja': 'ja',
      'ko': 'ko'
    };
    const youdaoTargetLang = langMap[targetLang] || targetLang;
    
    // 生成随机数
    const salt = Date.now().toString();
    // 组装字符串
    const input = text.length <= 20 ? text : text.substring(0, 10) + text.length + text.substring(text.length - 10);
    // 生成签名
    const sign = CryptoJS.SHA256(appKey + input + salt + appSecret).toString();
    
    const response = await axios.post('https://openapi.youdao.com/api', null, {
      params: {
        q: text,
        from: 'auto',
        to: youdaoTargetLang,
        appKey: appKey,
        salt: salt,
        sign: sign,
        signType: 'v3'
      }
    });
    
    if (response.data && response.data.translation && response.data.translation.length > 0) {
      return response.data.translation[0];
    }
    
    throw new Error('有道翻译结果格式不正确');
  } catch (error) {
    console.error('有道翻译出错:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`有道翻译服务错误 (${error.response.status}): ${error.response.statusText}`);
    } else if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('有道翻译服务出错，请稍后再试');
    }
  }
}

// 翻译接口函数
async function translateText(text: string, targetLang: string): Promise<string> {
  // 预处理文本，将编程风格的标识符转换为更自然的文本
  const processedText = preprocessText(text);
  
  // 获取翻译服务设置
  const config = vscode.workspace.getConfiguration('codeTranslateReader');
  const service = config.get<string>('translationService', TranslationService.Google);
  
  // 根据设置选择翻译服务
  switch (service) {
    case TranslationService.Baidu:
      return translateWithBaidu(processedText, targetLang);
    case TranslationService.Youdao:
      return translateWithYoudao(processedText, targetLang);
    case TranslationService.Google:
    default:
      return translateWithGoogle(processedText, targetLang);
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
      borderColor: new vscode.ThemeColor('editor.selectionHighlightBorder')
      // 移除了不支持的borderRadius和padding属性
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
  
  // 添加翻译服务配置命令
  const configTranslationServiceDisposable = vscode.commands.registerCommand(
    'code-translate-reader.configureTranslationService',
    async () => {
      const services = [
        { label: 'Google翻译 (全球可用但中国访问受限)', value: TranslationService.Google },
        { label: '百度翻译 (中国网络环境友好，需API密钥)', value: TranslationService.Baidu },
        { label: '有道翻译 (中国网络环境友好，需API密钥)', value: TranslationService.Youdao }
      ];
      
      const selected = await vscode.window.showQuickPick(
        services.map(s => s.label),
        { placeHolder: '选择翻译服务提供商' }
      );
      
      if (selected) {
        const service = services.find(s => s.label === selected);
        if (service) {
          const config = vscode.workspace.getConfiguration('codeTranslateReader');
          await config.update('translationService', service.value, vscode.ConfigurationTarget.Global);
          
          vscode.window.showInformationMessage(`已将翻译服务设置为: ${service.label}`);
          
          // 如果选择了需要密钥的服务，提示用户设置密钥
          if (service.value === TranslationService.Baidu) {
            const hasKeys = config.get('baiduAppId') && config.get('baiduAppSecret');
            if (!hasKeys) {
              const setKeys = await vscode.window.showInformationMessage(
                '百度翻译API需要AppID和密钥才能使用，请在设置中配置。',
                '打开设置'
              );
              if (setKeys === '打开设置') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'codeTranslateReader.baidu');
              }
            }
          } else if (service.value === TranslationService.Youdao) {
            const hasKeys = config.get('youdaoAppKey') && config.get('youdaoAppSecret');
            if (!hasKeys) {
              const setKeys = await vscode.window.showInformationMessage(
                '有道翻译API需要应用ID和密钥才能使用，请在设置中配置。',
                '打开设置'
              );
              if (setKeys === '打开设置') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'codeTranslateReader.youdao');
              }
            }
          }
        }
      }
    }
  );
  
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
  context.subscriptions.push(configTranslationServiceDisposable);
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
