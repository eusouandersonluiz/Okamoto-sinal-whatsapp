import path from "node:path";
import { existsSync } from "node:fs";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// In production (container) the API also serves the built web app, so the whole
// product runs as one process on one origin. Point WEB_DIST at the built assets
// (e.g. .../radar-web/dist/public); when unset (local dev with Vite proxy) this
// is skipped. Assumes the web app was built with BASE_PATH=/.
const webDist = process.env.WEB_DIST;
if (webDist && existsSync(webDist)) {
  app.use(express.static(webDist));
  // SPA fallback: any non-/api GET that didn't match a static file → index.html.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
  logger.info({ webDist }, "Serving built web app");
}

export default app;
