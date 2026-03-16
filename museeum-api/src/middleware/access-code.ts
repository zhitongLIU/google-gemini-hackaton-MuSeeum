import type { Request, Response, NextFunction } from "express";

export function requireAccessCode(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.JUDGE_ACCESS_CODE;
  if (!expected) {
    next();
    return;
  }
  const provided =
    (req.body && typeof req.body === "object" && (req.body as { accessCode?: string }).accessCode) ??
    req.get("x-judge-access-code") ??
    "";
  if (provided !== expected) {
    res.status(403).json({ error: "Invalid or missing access code" });
    return;
  }
  next();
}
