// proxy.js  (Next.js 16: "middleware" is now called "proxy")
//
// Runs before every page request. Anything not listed as public needs a
// Clerk session, so /admin, /accounts, ... can't even be loaded signed-out.
// This is the first lock only: the Express API checks role/permission on
// every call, which is what actually protects the data.

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublic = createRouteMatcher(["/", "/sign-in(.*)", "/robots.txt", "/sitemap.xml"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    await auth.protect(); // redirects to /sign-in when signed out
  }
});

export const config = {
  matcher: [
    // all routes except Next internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
