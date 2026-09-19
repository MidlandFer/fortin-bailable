import express from "express";
import { pool } from "./db/pool";

export function createServer() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", db: "up" });
    } catch (err) {
      console.error("Healthcheck falló:", err);
      res.status(503).json({ status: "error", db: "down" });
    }
  });

  return app;
}
