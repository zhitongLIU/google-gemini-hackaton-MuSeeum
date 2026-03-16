export function requireAccessCode(req, res, next) {
    const expected = process.env.JUDGE_ACCESS_CODE;
    if (!expected) {
        next();
        return;
    }
    const provided = (req.body && typeof req.body === "object" && req.body.accessCode) ??
        req.get("x-judge-access-code") ??
        "";
    if (provided !== expected) {
        res.status(403).json({ error: "Invalid or missing access code" });
        return;
    }
    next();
}
//# sourceMappingURL=access-code.js.map