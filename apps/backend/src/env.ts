import dotenv from "dotenv";
import path from "path";

// Load .env from backend root first, then project root
dotenv.config(); // apps/backend/.env
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
