// src/middlewares/errorHandler.js
// One place that turns errors into JSON. In production, unexpected errors
// return a generic message: stack traces and DB details never leave the server.

export const notFound = (req, res) => {
  res.status(404).json({ success: false, message: "API endpoint not found" });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.message?.startsWith("CORS blocked origin:")) {
    return res.status(403).json({ success: false, message: "Origin not allowed." });
  }

  // Mongoose validation / bad ObjectId / duplicate key -> client errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: Object.values(err.errors).map((e) => e.message).join(" "),
    });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ success: false, message: `Invalid ${err.path}.` });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "value";
    return res.status(409).json({ success: false, message: `This ${field} already exists.` });
  }
  if (err.name === "MulterError") {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "File is too large (photos max 3 MB, scans max 10 MB)." : "Only one file can be uploaded.";
    return res.status(413).json({ success: false, message: msg });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "Request is too large." });
  }

  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error("API Error:", err);

  res.status(status >= 400 && status < 600 ? status : 500).json({
    success: false,
    message: status >= 500 && process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
};
