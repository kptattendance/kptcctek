// src/middlewares/requireAuth.js
//
// Every API call:
//   1. Clerk verifies the session token (Google sign-in) - signature, expiry.
//   2. The person must be pre-registered by an admin in MongoDB. Signing in
//      with an unknown Google account gets 403: there is no self sign-up.
//   3. Role comes from MongoDB only (one source of truth). Clerk metadata
//      is never trusted for authorization.
//   4. Deactivated users are refused immediately, even with a valid session.

import { getAuth, clerkClient } from "@clerk/express";
import mongoose from "mongoose";
import User from "../models/User.js";

export const authenticateUser = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth?.isAuthenticated || !auth.userId) {
      return res.status(401).json({ success: false, message: "Please sign in." });
    }

    // Not lean(): schema defaults (isActive, lastLoginAt) apply to old records.
    let user = (await User.findOne({ clerkId: auth.userId }))?.toObject();

    // First login: link the pre-registered record by VERIFIED email.
    if (!user) {
      const clerkUser = await clerkClient.users.getUser(auth.userId);
      const verified = clerkUser.emailAddresses
        .filter((e) => e.verification?.status === "verified")
        .map((e) => e.emailAddress.toLowerCase());

      if (verified.length) {
        user = await User.findOneAndUpdate(
          // trusted() wraps each operator object we build ourselves (see sanitizeFilter in server.js)
          { email: mongoose.trusted({ $in: verified }), $or: [{ clerkId: mongoose.trusted({ $exists: false }) }, { clerkId: null }, { clerkId: "" }] },
          { $set: { clerkId: auth.userId } }, // keep the photo the admin uploaded
          { returnDocument: "after" }
        ).lean();
      }
    }

    if (!user) {
      return res.status(403).json({
        success: false,
        code: "NOT_REGISTERED",
        message: "This Google account is not registered with CCTEK. Ask the administrator to add you.",
      });
    }
    // Only an explicit false blocks: records created before isActive existed
    // (or inserted directly in MongoDB) don't have the field at all.
    if (user.isActive === false) {
      return res.status(403).json({ success: false, code: "DEACTIVATED", message: "Your access has been disabled." });
    }

    req.user = {
      id: auth.userId, // Clerk id
      dbId: user._id, // Mongo id: use this for createdBy / team / audit
      email: user.email,
      name: user.name,
      role: user.role,
    };

    // Record last login at most once an hour (avoid a write per request).
    if (!user.lastLoginAt || Date.now() - new Date(user.lastLoginAt).getTime() > 3_600_000) {
      User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } }).catch(() => {});
    }

    next();
  } catch (error) {
    next(error);
  }
};
