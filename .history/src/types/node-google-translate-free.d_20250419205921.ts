declare module 'node-google-translate-free' {
  interface TranslateResult {
    text: string;
    pronunciation: string;
    from: {
      language: {
        didYouMean: boolean;
        iso: string;
      };
      text: {
        autoCorrected: boolean;
        value: string;
        didYouMean: boolean;
      };
    };
  }

  export function translate(text: string, to: string, from?: string): Promise<TranslateResult>;
}