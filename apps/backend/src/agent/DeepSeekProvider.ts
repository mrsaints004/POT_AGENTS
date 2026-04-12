import OpenAI from "openai";
import { TaskType, ProviderConfig, PROVIDERS } from "@pot/shared";

export class DeepSeekProvider {
  private client: OpenAI;
  readonly config: ProviderConfig = PROVIDERS["deepseek-chat"];

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com",
    });
  }

  async execute(taskType: TaskType, input: string): Promise<{ result: string; tokensUsed: number }> {
    const prompt = this.buildPrompt(taskType, input);
    const response = await this.client.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
    });

    const result = response.choices[0]?.message?.content ?? "";
    const tokensUsed = (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0);

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
