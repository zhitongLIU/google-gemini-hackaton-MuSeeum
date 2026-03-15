import { Router } from "express";
import { randomUUID } from "crypto";

export type SessionRecord = { id: string; createdAt: number };

const sessions = new Map<string, SessionRecord>();

export function createSession(): SessionRecord {
  const id = randomUUID();
  const record: SessionRecord = { id, createdAt: Date.now() };
  sessions.set(id, record);
  return record;
}

export function getSession(sessionId: string): SessionRecord | undefined {
  return sessions.get(sessionId);
}

export const sessionRouter = Router();

sessionRouter.post("/session", (req, res) => {
  const expected = process.env.JUDGE_ACCESS_CODE;
  if (expected) {
    const provided = req.body?.accessCode ?? req.get("x-judge-access-code") ?? "";
    if (provided !== expected) {
      res.status(403).json({ error: "Invalid or missing access code" });
      return;
    }
  }
  const record = createSession();
  res.json({ sessionId: record.id });
});
