import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import nodePath from "path";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";

const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
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

// Initialize Stripe schema and sync data on startup
async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    log('DATABASE_URL not found, skipping Stripe initialization', 'stripe');
    return;
  }

  try {
    log('Initializing Stripe schema...', 'stripe');
    try {
      await runMigrations({ 
        databaseUrl
      });
      log('Stripe schema ready', 'stripe');
    } catch (migrationError: any) {
      log(`Stripe schema migration failed (non-critical): ${migrationError.message}`, 'stripe');
      log('Continuing without Stripe schema - payment features may be limited', 'stripe');
    }

    // Get StripeSync instance
    const stripeSync = await getStripeSync();

    // Set up managed webhook
    log('Setting up managed webhook...', 'stripe');
    const domains = process.env.REPLIT_DOMAINS?.split(',') || [];
    const webhookBaseUrl = domains[0] ? `https://${domains[0]}` : '';
    
    if (webhookBaseUrl) {
      try {
        // First create/find the webhook to get UUID, then update URL to include it
        const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
          `${webhookBaseUrl}/api/stripe/webhook/managed`,
          {
            enabled_events: ['*'],
            description: 'Managed webhook for SupernovaVid Stripe sync',
          }
        );
        // Store UUID for route matching - update webhook URL with actual UUID
        const webhookWithUuid = await stripeSync.findOrCreateManagedWebhook(
          `${webhookBaseUrl}/api/stripe/webhook/${uuid}`,
          {
            enabled_events: ['*'],
            description: 'Managed webhook for SupernovaVid Stripe sync',
          }
        );
        log(`Webhook configured: ${webhookWithUuid.webhook.url} (UUID: ${webhookWithUuid.uuid})`, 'stripe');
      } catch (webhookError: any) {
        log(`Stripe webhook setup failed: ${webhookError.message}`, 'stripe');
      }
    }

    // Sync all existing Stripe data in background (non-blocking)
    log('Syncing Stripe data in background...', 'stripe');
    stripeSync.syncBackfill()
      .then(() => {
        log('Stripe data synced', 'stripe');
      })
      .catch((err: Error) => {
        log(`Error syncing Stripe data: ${err.message}`, 'stripe');
      });
  } catch (error: any) {
    log(`Stripe initialization error (non-blocking): ${error.message}`, 'stripe');
    log('App will continue to function with limited Stripe support', 'stripe');
  }
}

// CRITICAL: Register Stripe webhook route BEFORE express.json()
// Webhook needs raw Buffer, not parsed JSON
app.post(
  '/api/stripe/webhook/:uuid',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        log('Webhook error: req.body is not a Buffer', 'stripe');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      const { uuid } = req.params;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig, uuid);

      res.status(200).json({ received: true });
    } catch (error: any) {
      log(`Webhook error: ${error.message}`, 'stripe');
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// Now apply JSON middleware for all other routes
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Serve uploaded files
app.use("/uploads", express.static(nodePath.join(process.cwd(), "uploads")));

app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize Stripe before registering routes
  await initStripe();

  const httpServer = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
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

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
