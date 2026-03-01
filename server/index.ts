// Load environment variables from .env file (must be first!)
import "dotenv/config";

// Prevent OpenAI SDK from crashing the process if OPENAI_API_KEY is not set.
// The SDK throws at construction time when no key is found. Features that need
// OpenAI will fail gracefully at call time instead of killing the server.
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = "not-configured";
}

// Log available env vars at startup (keys only, not values)
console.log(`[startup] Env vars: ${Object.keys(process.env).sort().join(', ')}`);

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedProductionIfEmpty } from "./seedProduction";
import { auth } from "./lib/auth";
import { toNodeHandler } from "better-auth/node";
import { startWorker, stopWorker } from "./jobs/worker";
import { pool } from "./db";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '5mb', // Increased for dev endpoints handling large brainlift content
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Health check endpoint - must be first, no dependencies
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Better Auth handler - must be before other routes
app.all("/api/auth/*", toNodeHandler(auth));

// Dev-only: auto-login endpoint that creates a session directly
if (process.env.NODE_ENV !== "production") {
  app.get("/dev/auto-login", async (_req, res) => {
    try {
      const { pool } = await import("./db");
      const crypto = await import("crypto");
      const userId = "local-dev-user";
      const sessionId = crypto.randomUUID();
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await pool.query(
        `INSERT INTO session (id, user_id, token, expires_at, created_at, updated_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, now(), now(), '127.0.0.1', 'dev-auto-login')
         ON CONFLICT (token) DO NOTHING`,
        [sessionId, userId, token, expiresAt]
      );
      res.cookie("better-auth.session_token", token, {
        httpOnly: true,
        path: "/",
        expires: expiresAt,
        sameSite: "lax",
      });
      res.redirect("/");
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const jsonStr = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${jsonStr.length > 200 ? jsonStr.slice(0, 200) + '...' : jsonStr}`;
      }

      log(logLine);
    }
  });

  next();
});

// Start listening FIRST so healthcheck passes, then initialize
const port = parseInt(process.env.PORT || "5000", 10);
httpServer.listen(
  {
    port,
    host: "0.0.0.0",
  },
  () => {
    log(`serving on port ${port}`);
  },
);

(async () => {
  try {
    // Auto-seeding disabled for production

    await registerRoutes(httpServer, app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      if (!res.headersSent) {
        res.status(status).json({ message });
      }
      console.error('[unhandled]', err);
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    // Start Graphile Worker (Option 1: same process)
    let worker = null;
    try {
      worker = await startWorker();
      log('[Worker] Started successfully', 'server');
    } catch (error) {
      log(`[Worker] Failed to start: ${error}`, 'server');
      // Don't crash server if worker fails - log and continue
    }

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      log(`Received ${signal}, shutting down gracefully...`, 'server');

      // Stop accepting new connections and wait for in-flight HTTP requests to complete
      await new Promise<void>((resolve) => {
        httpServer.close(() => {
          log('HTTP server closed', 'server');
          resolve();
        });
      });

      // Stop worker (waits for in-flight jobs to complete)
      if (worker) {
        await stopWorker();
      }

      // Close database pool after all work is done
      await pool.end();

      log('Shutdown complete', 'server');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    log('Server fully initialized', 'server');
  } catch (error) {
    log(`[FATAL] Server initialization failed: ${error}`, 'server');
    // Don't exit - healthcheck endpoint still works
  }
})();
