import mongoose from "mongoose";

// Reuse one connection per server instance (important on Vercel).
// If a connection attempt fails, the next request tries again
// instead of crashing the server.
const cached = globalThis._mongo || (globalThis._mongo = { conn: null, promise: null });

const connectDB = async () => {
  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not defined");
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGO_URI, {
        dbName: process.env.MONGO_DB_NAME || "kptia",
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 5,
      })
      .then((m) => {
        console.log(`✅ MongoDB connected.....: ${m.connection.host}`);
        return m;
      })
      .catch((err) => {
        cached.promise = null; // allow retry on the next request
        console.error("❌ MongoDB connection error........:", err.message);
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

export default connectDB;