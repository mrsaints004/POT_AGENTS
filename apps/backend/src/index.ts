import { startLocalServer } from "./app";

const { io } = startLocalServer();

export { io };
