import "dotenv/config";
import express from "express";
import cors from "cors";
// @ts-expect-error no types
import expressWs from "express-ws";
import { sessionRouter } from "./routes/session.js";
import { attachLiveWs } from "./routes/live.js";
const app = express();
const PORT = Number(process.env.PORT) || 8080;
app.use(cors({ origin: "*" }));
app.use(express.json());
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
app.use("/api", sessionRouter);
expressWs(app);
attachLiveWs(app);
app.listen(PORT, () => {
    console.log(`MuSeeum API listening on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map