import { TaskType, ProviderConfig, PROVIDERS } from "@pot/shared";

export class MockProvider {
  readonly config: ProviderConfig = PROVIDERS["mock"];

  async execute(taskType: TaskType, input: string): Promise<{ result: string; tokensUsed: number }> {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    const results: Record<string, string> = {
      "text-generation": `[Mock] Generated text for: "${input.substring(0, 50)}..." — This is a simulated response from the mock provider for testing purposes.`,
      translation: `[Mock] Translation of: "${input.substring(0, 50)}..." — Ceci est une traduction simulée.`,
      "code-review": `[Mock] Code review for the provided code:\n- No critical issues found\n- Consider adding type annotations\n- Good overall structure`,
      summarization: `[Mock] Summary: The provided text discusses "${input.substring(0, 30)}..." and covers the main points in a concise manner.`,
      custom: `[Mock] Custom task result for: "${input.substring(0, 50)}..." — Mock response for custom task.`,
    };

    return {
      result: results[taskType] || results["custom"],
      tokensUsed: 50,
    };
  }
}
