import Anthropic from "@anthropic-ai/sdk";
import { TaskType, ProviderConfig, PROVIDERS } from "@pot/shared";

export class ClaudeProvider {
  private client: Anthropic;
  readonly config: ProviderConfig = PROVIDERS["claude-sonnet"];

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async execute(taskType: TaskType, input: string): Promise<{ result: string; tokensUsed: number }> {
    const prompt = this.buildPrompt(taskType, input);
    const message = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const result = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const tokensUsed = (message.usage?.input_tokens ?? 0) + (message.usage?.output_tokens ?? 0);

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
