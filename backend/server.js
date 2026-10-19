import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import mongoose from "mongoose";
import connectDB from "./src/config/db.js";

import accountRoutes from "./src/routes/accountRoutes.js";
import projectRoutes from "./src/routes/projectRoutes.js";
import billingRoutes from "./src/routes/billingRoutes.js";
import deskRoutes from "./src/routes/deskRoutes.js";
import { errorHandler, notFound } from "./src/middlewares/errorHandler.js";

dotenv.config();

// Reject queries like { email: { $ne: null } } built from request input
// (NoSQL injection), and ignore unknown filter fields.
mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

const app = express();
const PORT = process.env.PORT || 5000;

// Behind Vercel / a reverse proxy: needed for correct client IPs in the
// rate limiter and audit log.
app.set("trust proxy", 1);
app.disable("x-powered-by");

// --------------------------------------------------
// 0. SECURITY HEADERS + RATE LIMITS
// --------------------------------------------------

// JSON API only: deny framing, sniffing, referrers; strict HTTPS.
app.use(
  helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: "same-site" },
    referrerPolicy: { policy: "no-referrer" },
  })
);

app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 300, // per IP per minute: generous for office use, stops scripted abuse
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { success: false, message: "Too many requests. Please wait a minute." },
  })
);

// Writes are rarer; throttle them harder.
app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    skip: (req) => req.method === "GET" || req.method === "OPTIONS",
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { success: false, message: "Too many changes in a short time. Please wait a minute." },
  })
);

// --------------------------------------------------
// 1. CORS CONFIGURATION
// --------------------------------------------------

const allowedOrigins = (
  process.env.FRONTEND_URLS || "http://localhost:3000"
)
  .split(",")
  .map((url) => url.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin.replace(/\/$/, ""))
      ) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  })
);

// --------------------------------------------------
// 2. REQUEST PARSING
// --------------------------------------------------

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// --------------------------------------------------
// 3. CLERK AUTHENTICATION MIDDLEWARE
// --------------------------------------------------

app.use(clerkMiddleware());

// Serverless (Vercel) has no startup hook: make sure the cached DB
// connection is ready before any API handler runs.
app.use("/api", async (req, res, next) => {
  if (req.path === "/health") return next();
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------
// 4. ROOT ROUTE
// --------------------------------------------------

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "CCTEK Billing API is running",
    environment: process.env.NODE_ENV || "development",
  });
});

// --------------------------------------------------
// 5. HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    message: databaseConnected
      ? "CCTEK API and database are running"
      : "API is running, but database is not connected",
    database: databaseConnected ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// --------------------------------------------------
// 6. USER ROUTES
// --------------------------------------------------

app.use("/api/users", accountRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/desk", deskRoutes);

// --------------------------------------------------
// 7. API NOT FOUND HANDLER
// --------------------------------------------------

app.use("/api", notFound);

// --------------------------------------------------
// 8. CENTRALIZED ERROR HANDLER
// --------------------------------------------------

app.use(errorHandler);

// --------------------------------------------------
// 9. START SERVER
// --------------------------------------------------

export default app;

if (process.env.NODE_ENV !== "production") {
  const startServer = async () => {
    try {
      await connectDB();

      app.listen(PORT, () => {
        console.log(`CCTEK backend running on port ${PORT}`);
      });
    } catch (error) {
      console.error("Failed to start CCTEK backend:", error);
      process.exit(1);
    }
  };

  startServer();
}