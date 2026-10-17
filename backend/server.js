import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { clerkMiddleware } from "@clerk/express";
import mongoose from "mongoose";
import connectDB from "./src/config/db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// --------------------------------------------------
// 1. CORS CONFIGURATION
// --------------------------------------------------

const allowedOrigins = (process.env.FRONTEND_URLS || "http://localhost:3000")
  .split(",")
  .map((url) => url.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header, such as server-to-server calls.
      if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ""))) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
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

// --------------------------------------------------
// 4. BASIC ROUTES
// --------------------------------------------------

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "CCTEK Billing API is running",
    environment: process.env.NODE_ENV || "development",
  });
});

// API health check
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
// 5. API NOT FOUND HANDLER
// --------------------------------------------------

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
    path: req.originalUrl,
  });
});

// --------------------------------------------------
// 6. CENTRALIZED ERROR HANDLER
// --------------------------------------------------

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || err.statusCode || 500;

  if (err.message?.startsWith("CORS blocked origin:")) {
    return res.status(403).json({
      success: false,
      message: "Origin not allowed by CORS",
    });
  }

  console.error("API Error:", err);

  res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error",
  });
});

// --------------------------------------------------
// 7. START SERVER AFTER DATABASE CONNECTION
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

