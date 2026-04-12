import { GoogleGenerativeAI } from "@google/generative-ai";
import { TaskType, ProviderConfig, PROVIDERS } from "@pot/shared";

export class GeminiFlashProvider {
  private client: GoogleGenerativeAI;
  readonly config: ProviderConfig = PROVIDERS["gemini-flash"];

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async execute(taskType: TaskType, input: string): Promise<{ result: string; tokensUsed: number }> {
    const model = this.client.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = this.buildPrompt(taskType, input);
    const response = await model.generateContent(prompt);
    const result = response.response.text();
    const tokensUsed = result.length / 4;

    return { result, tokensUsed };
  }

  private buildPrompt(taskType: TaskType, input: string): string {
    const prompts: Record<string, string> = {
      "text-generation": `Generate text based on: ${input}`,
      translation: `Translate: ${input}`,
      "code-review": `Quick code review: ${input}`,
      summarization: `Summarize: ${input}`,
      custom: input,
    };
    return prompts[taskType] || input;
  }
}
