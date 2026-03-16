import type { Request, Response, NextFunction } from "express";
/**
 * Middleware that rejects requests without a valid app id when MUSEEUM_APP_ID is set.
 * Only museeum-web should know this value (injected at build time).
 * Skips WebSocket upgrade requests (/api/live/...) which are validated in the ws handler via query param.
 */
export declare function requireAppId(req: Request, res: Response, next: NextFunction): void;
export declare function getExpectedAppId(): string | undefined;
export declare function validateAppIdFromQuery(appId: string | undefined): boolean;
//# sourceMappingURL=app-id.d.ts.map