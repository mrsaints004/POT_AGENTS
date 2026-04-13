#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { io } from "socket.io-client";

const program = new Command();

const DEFAULT_API_URL = "http://localhost:3002";

function getApiUrl(): string {
  return program.opts().apiUrl || process.env.POT_API_URL || DEFAULT_API_URL;
}

async function fetchApi(path: string, options?: RequestInit) {
  const url = `${getApiUrl()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

program
  .name("pot-cli")
  .description("Proof of Thought — CLI tool for autonomous AI task execution")
  .version("0.0.1")
  .option("--api-url <url>", "Backend API URL", DEFAULT_API_URL);

// Task commands
const taskCmd = program.command("task").description("Manage AI tasks");

taskCmd
  .command("create")
  .description("Create a new AI task")
  .requiredOption("--type <type>", "Task type: text-generation, translation, code-review, summarization, custom")
  .requiredOption("--input <input>", "Task input text")
  .option("--provider <provider>", "Preferred provider: claude-sonnet, gpt-4o, gemini-pro, gemini-flash, deepseek-chat")
  .option("--max-cost <cost>", "Max cost in USD", "0.05")
  .option("--watch", "Watch task progress in real-time")
  .action(async (opts) => {
    const spinner = ora("Creating task...").start();
    try {
      const body: Record<string, unknown> = {
        type: opts.type,
        input: opts.input,
        maxCostUsd: parseFloat(opts.maxCost),
      };
      if (opts.provider) body.preferredProvider = opts.provider;

      const result = await fetchApi("/api/tasks", {
        method: "POST",
        body: JSON.stringify(body),
      });

      spinner.succeed(chalk.green(`Task created: ${result.taskId}`));
      console.log(chalk.gray(`View: ${getApiUrl().replace("/api", "")}/tasks/${result.taskId}`));

      if (opts.watch) {
        await watchTask(result.taskId);
      }
    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${err instanceof Error ? err.message : err}`));
      process.exit(1);
    }
  });

taskCmd
  .command("status <id>")
  .description("Get task status")
  .option("--watch", "Watch for real-time updates")
  .action(async (id, opts) => {
    const spinner = ora("Fetching task...").start();
    try {
      const task = await fetchApi(`/api/tasks/${id}`);
      spinner.stop();
      printTask(task);

      if (opts.watch && task.status !== "completed" && task.status !== "failed") {
        await watchTask(id);
      }
    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${err instanceof Error ? err.message : err}`));
      process.exit(1);
    }
  });

taskCmd
  .command("list")
  .description("List recent tasks")
  .option("--limit <n>", "Number of tasks to show", "10")
  .action(async (opts) => {
    const spinner = ora("Fetching tasks...").start();
    try {
      const tasks = await fetchApi("/api/tasks");
      spinner.stop();

      if (tasks.length === 0) {
        console.log(chalk.gray("No tasks found."));
        return;
      }

      const limit = parseInt(opts.limit, 10);
      const shown = tasks.slice(0, limit);

      console.log(chalk.bold(`\nRecent Tasks (${shown.length} of ${tasks.length}):\n`));

      for (const task of shown) {
        const statusColor =
          task.status === "completed" ? chalk.green :
          task.status === "failed" ? chalk.red :
          task.status === "executing" ? chalk.yellow :
          chalk.gray;

        console.log(
          `  ${chalk.gray(task.id.substring(0, 8))}  ${statusColor(task.status.padEnd(12))}  ${chalk.cyan(task.type.padEnd(16))}  ${chalk.white(task.input?.substring(0, 50) ?? "")}${(task.input?.length ?? 0) > 50 ? "..." : ""}`
        );
      }
      console.log();
    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${err instanceof Error ? err.message : err}`));
      process.exit(1);
    }
  });

// Compare command
program
  .command("compare")
  .description("Run Compare Mode — execute task on all providers simultaneously")
  .requiredOption("--type <type>", "Task type")
  .requiredOption("--input <input>", "Task input text")
  .option("--max-cost <cost>", "Max cost in USD", "0.1")
  .action(async (opts) => {
    const spinner = ora("Creating comparison task...").start();
    try {
      const result = await fetchApi("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          type: opts.type,
          input: opts.input,
          maxCostUsd: parseFloat(opts.maxCost),
          compareMode: true,
        }),
      });

      spinner.succeed(chalk.green(`Comparison started: ${result.taskId}`));
      console.log(chalk.purple?.("Running all providers in parallel...") ?? chalk.magenta("Running all providers in parallel..."));

      await watchTask(result.taskId);
    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${err instanceof Error ? err.message : err}`));
      process.exit(1);
    }
  });

// Agent command
const agentCmd = program.command("agent").description("Agent information");

agentCmd
  .command("status")
  .description("Show agent profile and passport info")
  .action(async () => {
    const spinner = ora("Fetching agent info...").start();
    try {
      const [profile, status, passport] = await Promise.all([
        fetchApi("/api/agent/profile"),
        fetchApi("/api/agent/status"),
        fetchApi("/api/agent/passport").catch(() => null),
      ]);

      spinner.stop();

      console.log(chalk.bold("\nAgent Profile\n"));
      console.log(`  ${chalk.gray("Address:")}       ${chalk.cyan(status.agentAddress)}`);
      console.log(`  ${chalk.gray("Network:")}       ${status.chain.name} (Chain ID: ${status.chain.chainId})`);
      console.log(`  ${chalk.gray("Tasks:")}         ${profile.tasksCompleted} completed / ${profile.tasksTotal} total`);
      console.log(`  ${chalk.gray("Success Rate:")}  ${chalk.green(profile.successRate + "%")}`);
      console.log(`  ${chalk.gray("Total Earned:")}  ${chalk.green("$" + profile.totalEarned.toFixed(6))}`);
      console.log(`  ${chalk.gray("Attestations:")}  ${profile.onChainAttestations} on-chain`);
      console.log(`  ${chalk.gray("Comparisons:")}   ${profile.comparisonsRun ?? 0} run`);

      if (passport) {
        console.log(chalk.bold("\nAgent Passport\n"));
        console.log(`  ${chalk.gray("Registered:")}    ${passport.isRegistered ? chalk.green("Yes") : chalk.yellow("No")}`);
        console.log(`  ${chalk.gray("Trust Score:")}   ${chalk.cyan(passport.trustScore + "/100")}`);
        console.log(`  ${chalk.gray("Capabilities:")}  ${passport.capabilities.join(", ")}`);
      }

      if (status.crossChain) {
        console.log(chalk.bold("\nCross-Chain\n"));
        console.log(`  ${chalk.gray("Kite Testnet:")} ${chalk.green("Connected")}`);
        console.log(`  ${chalk.gray("LayerZero:")}    ${status.crossChain.layerZero.available ? chalk.green("Available") : chalk.gray("Unavailable")}`);
        console.log(`  ${chalk.gray("Networks:")}     ${status.crossChain.layerZero.supportedNetworks.join(", ")}`);
      }

      console.log();
    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${err instanceof Error ? err.message : err}`));
      process.exit(1);
    }
  });

// Watch task progress via WebSocket
async function watchTask(taskId: string): Promise<void> {
  return new Promise((resolve) => {
    const apiUrl = getApiUrl();
    const socket = io(apiUrl);

    console.log(chalk.gray(`\nWatching task ${taskId}...\n`));

    socket.on("task:update", (data: { taskId: string; status: string }) => {
      if (data.taskId !== taskId) return;
      console.log(`  ${chalk.blue("status")}  ${data.status}`);

      if (data.status === "completed" || data.status === "failed") {
        const icon = data.status === "completed" ? chalk.green("done") : chalk.red("failed");
        console.log(`\n  ${icon}\n`);
        socket.disconnect();
        resolve();
      }
    });

    socket.on("attestation:step", (data: { taskId: string; step: { action: string; description: string } }) => {
      if (data.taskId !== taskId) return;
      console.log(`  ${chalk.gray("step")}    ${chalk.cyan(data.step.action.padEnd(20))} ${data.step.description}`);
    });

    socket.on("attestation:finalized", (data: { taskId: string; txHash?: string }) => {
      if (data.taskId !== taskId) return;
      if (data.txHash) {
        console.log(`  ${chalk.green("tx")}      ${chalk.cyan(data.txHash)}`);
      }
    });

    socket.on("compare:provider-complete", (data: { taskId: string; provider: string; costUsd: number; durationMs: number }) => {
      if (data.taskId !== taskId) return;
      console.log(`  ${chalk.magenta("compare")} ${chalk.white(data.provider.padEnd(16))} $${data.costUsd.toFixed(6)} in ${(data.durationMs / 1000).toFixed(1)}s`);
    });

    socket.on("compare:provider-failed", (data: { taskId: string; provider: string; error: string }) => {
      if (data.taskId !== taskId) return;
      console.log(`  ${chalk.red("failed")}  ${chalk.white(data.provider.padEnd(16))} ${data.error}`);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      console.log(chalk.yellow("\n  Timeout — task still running. Use `pot-cli task status` to check."));
      socket.disconnect();
      resolve();
    }, 300_000);
  });
}

function printTask(task: Record<string, unknown>) {
  const statusColor =
    task.status === "completed" ? chalk.green :
    task.status === "failed" ? chalk.red :
    chalk.yellow;

  console.log(chalk.bold(`\nTask ${(task.id as string).substring(0, 8)}\n`));
  console.log(`  ${chalk.gray("Status:")}    ${statusColor(task.status as string)}`);
  console.log(`  ${chalk.gray("Type:")}      ${task.type}`);
  console.log(`  ${chalk.gray("Provider:")}  ${task.selectedProvider ?? "auto"}`);
  console.log(`  ${chalk.gray("Max Cost:")}  $${task.maxCostUsd}`);
  console.log(`  ${chalk.gray("Created:")}   ${task.createdAt}`);

  if (task.result) {
    console.log(`  ${chalk.gray("Result:")}    ${(task.result as string).substring(0, 200)}${(task.result as string).length > 200 ? "..." : ""}`);
  }

  if (task.attestationId) {
    console.log(`  ${chalk.gray("Attestation:")} ${task.attestationId}`);
  }

  console.log();
}

program.parse();
