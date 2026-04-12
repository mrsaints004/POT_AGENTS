import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import multer from "multer";
import { db } from "../db";
import { tasks, comparisonResults } from "../schema";
import { AgentCore } from "../agent/AgentCore";
import { DecisionEngine } from "../agent/DecisionEngine";
import { TaskCreateInput, TaskType, ProviderName } from "@pot/shared";
import { parseFile } from "../utils/fileParser";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get("/", async (_req, res) => {
  try {
    const allTasks = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
    res.json(allTasks);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const rows = await db.select().from(tasks).where(eq(tasks.id, req.params.id));
    if (rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch task" });
  }
});

router.post("/estimate", async (req, res) => {
  try {
    const { type, input } = req.body as { type: TaskType; input: string };
    if (!type || !input) {
      return res.status(400).json({ error: "Missing required fields: type, input" });
    }
    const engine = new DecisionEngine();
    const estimate = engine.estimateTaskCost(type, input);
    res.json(estimate);
  } catch (error) {
    res.status(500).json({ error: "Failed to estimate cost" });
  }
});

router.post("/", upload.single("file"), async (req, res) => {
  try {
    // When using multipart form, fields are in req.body as strings
    const input: TaskCreateInput = {
      type: req.body.type,
      input: req.body.input,
      maxCostUsd: parseFloat(req.body.maxCostUsd),
      escrowTxHash: req.body.escrowTxHash,
      depositorAddress: req.body.depositorAddress,
      taskId: req.body.taskId,
      preferredProvider: req.body.preferredProvider || undefined,
    };

    if (!input.type || !input.input || !input.maxCostUsd) {
      return res.status(400).json({ error: "Missing required fields: type, input, maxCostUsd" });
    }

    if (!input.escrowTxHash || !input.depositorAddress) {
      return res.status(400).json({ error: "Missing required fields: escrowTxHash, depositorAddress. User must deposit escrow via wallet." });
    }

    // Handle file upload
    if (req.file) {
      try {
        const fileText = await parseFile(req.file.buffer, req.file.mimetype);
        input.fileContent = fileText;
        input.fileName = req.file.originalname;
        // Prepend file content to input
        input.input = `[Uploaded file: ${req.file.originalname}]\n\n${fileText}\n\n---\n\n${input.input}`;
      } catch (err) {
        return res.status(400).json({ error: `Failed to parse file: ${err instanceof Error ? err.message : "Unknown error"}` });
      }
    }

    const io = req.app.get("io");
    const agent = new AgentCore(io);

    const compareMode = req.body.compareMode === true || req.body.compareMode === "true";

    if (compareMode) {
      input.compareMode = true;
    }

    const taskIdPromise = compareMode
      ? agent.executeComparison(input)
      : agent.executeTask(input);

    const taskId = await taskIdPromise.catch((err) => {
      console.error("Task execution failed:", err);
      return null;
    });

    if (taskId) {
      res.status(201).json({ taskId });
    } else {
      res.status(500).json({ error: "Failed to create task" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to create task" });
  }
});

// Retry a completed task with an optional different provider
router.post("/:id/retry", async (req, res) => {
  try {
    const originalId = req.params.id;
    const { preferredProvider } = req.body as { preferredProvider?: ProviderName };

    // Fetch original task
    const rows = await db.select().from(tasks).where(eq(tasks.id, originalId));
    if (rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const original = rows[0];
    if (original.status !== "completed" && original.status !== "failed") {
      return res.status(400).json({ error: "Can only retry completed or failed tasks" });
    }

    const retryCount = (original.retryCount ?? 0) + 1;
    const taskId = crypto.randomUUID();

    // Pre-create the task row so the frontend can navigate to it immediately
    await db.insert(tasks).values({
      id: taskId,
      type: original.type,
      input: original.input,
      maxCostUsd: original.maxCostUsd,
      status: "pending",
      paymentStatus: original.paymentStatus ?? "none",
      escrowTxHash: original.escrowTxHash,
      retryOf: originalId,
      retryCount,
      fileName: original.fileName,
      fileContent: original.fileContent,
    });

    // Return immediately so frontend can navigate
    res.status(201).json({ taskId });

    // Execute in background
    const io = req.app.get("io");
    const agent = new AgentCore(io);

    const retryInput: TaskCreateInput = {
      type: original.type as TaskType,
      input: original.input,
      maxCostUsd: original.maxCostUsd,
      escrowTxHash: original.escrowTxHash ?? undefined,
      depositorAddress: original.escrowTxHash ? "retry" : undefined,
      preferredProvider: preferredProvider || undefined,
      fileName: original.fileName ?? undefined,
      fileContent: original.fileContent ?? undefined,
      taskId,
    };

    agent.executeTask(retryInput).catch((err) => {
      console.error("Retry task execution failed:", err);
    });
  } catch (error) {
    console.error("Retry route error:", error);
    res.status(500).json({ error: "Failed to retry task" });
  }
});

// Get comparison results for a compare-mode task
router.get("/:id/comparisons", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(comparisonResults)
      .where(eq(comparisonResults.taskId, req.params.id));
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch comparison results" });
  }
});

// Pick a winner from comparison results
router.post("/:id/pick-winner", async (req, res) => {
  try {
    const taskId = req.params.id;
    const { provider } = req.body as { provider: string };

    if (!provider) {
      return res.status(400).json({ error: "Missing required field: provider" });
    }

    // Validate task exists and is in compare mode
    const taskRows = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (taskRows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = taskRows[0];
    if (!task.compareMode) {
      return res.status(400).json({ error: "Task is not in compare mode" });
    }
    if (task.status !== "completed") {
      return res.status(400).json({ error: "Task is not yet completed" });
    }

    // Find the winning comparison result
    const compRows = await db
      .select()
      .from(comparisonResults)
      .where(eq(comparisonResults.taskId, taskId));
    const winnerRow = compRows.find((r) => r.provider === provider);

    if (!winnerRow || winnerRow.status !== "completed") {
      return res.status(400).json({ error: "Selected provider did not complete successfully" });
    }

    // Update task with winning provider and result
    await db.update(tasks).set({
      winningProvider: provider,
      selectedProvider: provider,
      result: winnerRow.result,
    }).where(eq(tasks.id, taskId));

    // Record on-chain attestation for the winner
    const io = req.app.get("io");
    const agent = new AgentCore(io);

    const updatedRows = await db.select().from(tasks).where(eq(tasks.id, taskId));
    res.json(updatedRows[0]);
  } catch (error) {
    console.error("Pick winner error:", error);
    res.status(500).json({ error: "Failed to pick winner" });
  }
});

export { router as taskRoutes };
