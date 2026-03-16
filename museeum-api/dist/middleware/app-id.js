const APP_ID_HEADER = "x-museeum-app-id";
/**
 * Middleware that rejects requests without a valid app id when MUSEEUM_APP_ID is set.
 * Only museeum-web should know this value (injected at build time).
 * Skips WebSocket upgrade requests (/api/live/...) which are validated in the ws handler via query param.
 */
export function requireAppId(req, res, next) {
    if (req.path.startsWith("/api/live/")) {
        next();
        return;
    }
    const expected = process.env.MUSEEUM_APP_ID;
    if (!expected) {
        next();
        return;
    }
    const provided = req.get(APP_ID_HEADER);
    if (provided !== expected) {
        res.status(401).json({ error: "Invalid or missing app id" });
        return;
    }
    next();
}
export function getExpectedAppId() {
    return process.env.MUSEEUM_APP_ID;
}
export function validateAppIdFromQuery(appId) {
    const expected = process.env.MUSEEUM_APP_ID;
    if (!expected)
        return true;
    return appId === expected;
}
//# sourceMappingURL=app-id.js.map