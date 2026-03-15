export type SessionRecord = {
    id: string;
    createdAt: number;
};
export declare function createSession(): SessionRecord;
export declare function getSession(sessionId: string): SessionRecord | undefined;
export declare const sessionRouter: import("express-serve-static-core").Router;
//# sourceMappingURL=session.d.ts.map