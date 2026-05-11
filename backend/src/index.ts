import "dotenv/config";
import express from "express";
import cors from "cors";
import { tokenRouter } from "./routes/token.js";
import { evaluationRouter } from "./routes/evaluation.js";
import { studentRouter } from "./routes/student.js";
import { guardrailsRouter } from "./routes/guardrails.js";
import { reportRouter } from "./routes/report.js";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "12mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", tokenRouter);
app.use("/api", evaluationRouter);
app.use("/api", reportRouter);
app.use("/api", studentRouter);
app.use("/api", guardrailsRouter);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`[backend] listening on :${port}`));
