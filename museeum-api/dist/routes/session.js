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
//# sourceMappingURL=session.js.map