import { Router } from "express";
import { randomUUID } from "crypto";
const sessions = new Map();
export function createSession() {
    const id = randomUUID();
    const record = { id, createdAt: Date.now() };
    sessions.set(id, record);
    return record;
}
export function getSession(sessionId) {
    return sessions.get(sessionId);
}
export const sessionRouter = Router();
sessionRouter.post("/session", (_req, res) => {
    const record = createSession();
    res.json({ sessionId: record.id });
});
//# sourceMappingURL=session.js.map