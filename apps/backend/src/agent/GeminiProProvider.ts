import { GoogleGenerativeAI } from "@google/generative-ai";
import { TaskType, ProviderConfig, PROVIDERS } from "@pot/shared";

export class GeminiProProvider {
  private client: GoogleGenerativeAI;
  readonly config: ProviderConfig = PROVIDERS["gemini-pro"];

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async execute(taskType: TaskType, input: string): Promise<{ result: string; tokensUsed: number }> {
    const model = this.client.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = this.buildPrompt(taskType, input);
    const response = await model.generateContent(prompt);
    const result = response.response.text();
    const tokensUsed = result.length / 4; // rough estimate

    return { result, tokensUsed };
  }

  private buildPrompt(taskType: TaskType, input: string): string {
    const prompts: Record<string, string> = {
      "text-generation": `Generate high-quality text based on the following request:\n\n${input}`,
      translation: `Translate the following text accurately:\n\n${input}`,
      "code-review": `Review the following code and provide detailed feedback on quality, bugs, and improvements:\n\n${input}`,
      summarization: `Provide a concise and comprehensive summary of the following text:\n\n${input}`,
      custom: input,
    };
    return prompts[taskType] || input;
  }
}
