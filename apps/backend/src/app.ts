import "./env";
import express, { Express } from "express";
import cors from "cors";
import { createServer, Server as HttpServer } from "http";
import { Server } from "socket.io";
import { taskRoutes } from "./routes/tasks";
import { attestationRoutes } from "./routes/attestations";
import { agentRoutes } from "./routes/agent";
import { x402Routes } from "./routes/x402";
import { gaslessRoutes } from "./routes/gasless";
import { statusRoutes } from "./routes/status";
import { discoveryRoutes } from "./routes/discovery";
import { KiteClient } from "./blockchain/KiteClient";

function createNoopIo(): Server {
  const chain = {
    emit: () => chain,
    on: () => chain,
    to: () => chain,
    except: () => chain,
    in: () => chain,
  };
  return chain as unknown as Server;
}

function getAllowedOrigins(): string[] {
  return [
    "http://localhost:3000",
    "http://localhost:3001",
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ];
}

/** Express app for HTTP API (Vercel serverless and local dev). */
export function createApp(): Express {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json());
  app.set("io", createNoopIo());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/", (_req, res) => {
    res.json({
      name: "Proof of Thought Agent API",
      health: "/api/health",
      status: "/api/status",
    });
  });

  app.use("/api/tasks", taskRoutes);
  app.use("/api/attestations", attestationRoutes);
  app.use("/api/agent", agentRoutes);
  app.use("/api/x402", x402Routes);
  app.use("/api/gasless", gaslessRoutes);
  app.use("/api/status", statusRoutes);
  app.use("/api/discovery", discoveryRoutes);

  return app;
}

/** Default export for Vercel (@vercel/node requires a function or server). */
export default createApp();

/** Attach Socket.IO to an HTTP server (local / long-running hosts only). */
export function attachSocketIo(app: Express, server: HttpServer): Server {
  const allowedOrigins = getAllowedOrigins();
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
    },
  });

  app.set("io", io);

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function registerOnChainService(): void {
  const privateKey = process.env.PRIVATE_KEY;
  const contractAddress = process.env.PROOF_OF_THOUGHT_CONTRACT;
  if (privateKey && contractAddress) {
    const kiteClient = new KiteClient(privateKey, contractAddress);
    kiteClient.registerAsService().catch(() => {});
  }
}

/** Start a local HTTP server with WebSocket support. */
export function startLocalServer(): { app: Express; server: HttpServer; io: Server } {
  const app = createApp();
  const server = createServer(app);
  const io = attachSocketIo(app, server);
  const port = parseInt(process.env.PORT || "3002", 10);

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
    registerOnChainService();
  });

  return { app, server, io };
}
