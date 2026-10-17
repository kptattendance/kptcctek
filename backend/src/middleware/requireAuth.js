// src/middleware/authMiddleware.js

import { getAuth, clerkClient } from "@clerk/express";

import { normalizeRole } from "../config/roles.js";

export const authenticateUser = async (req, res, next) => {
  try {
    const auth = getAuth(req);

   

    if (!auth.isAuthenticated || !auth.userId) {
      return res.status(401).json({
        error: "Unauthorized. No authenticated Clerk user found.",
      });
    }

    const user = await clerkClient.users.getUser(auth.userId);

    if (!user) {
      return res.status(401).json({
        error: "Unauthorized. Clerk user not found.",
      });
    }

    req.user = {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      // Old "exam_officer" accounts work as "office"
      role: normalizeRole(user.publicMetadata?.role),
      department: user.publicMetadata?.department || null,
    };

    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);

    return res.status(401).json({
      error: "Unauthorized request",
    });
  }
};