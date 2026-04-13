import "./env"; // Must be first — loads .env before any other imports
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { taskRoutes } from "./routes/tasks";
import { attestationRoutes } from "./routes/attestations";
import { agentRoutes } from "./routes/agent";
import { x402Routes } from "./routes/x402";
import { gaslessRoutes } from "./routes/gasless";
import { KiteClient } from "./blockchain/KiteClient";

const app = express();
const server = createServer(app);

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Make io available to routes
app.set("io", io);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/tasks", taskRoutes);
app.use("/api/attestations", attestationRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/x402", x402Routes);
app.use("/api/gasless", gaslessRoutes);

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = parseInt(process.env.PORT || "3002", 10);
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Attempt Kite Service Registry registration (non-blocking)
  const privateKey = process.env.PRIVATE_KEY;
  const contractAddress = process.env.PROOF_OF_THOUGHT_CONTRACT;
  if (privateKey && contractAddress) {
    const kiteClient = new KiteClient(privateKey, contractAddress);
    kiteClient.registerAsService().catch(() => {});
  }
});

export { io };
