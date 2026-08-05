import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Protected-first: app data routes require auth.
 * Public: landing (`/`), Clerk pages, static assets (via matcher), `/__clerk`.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/__clerk(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  await auth.protect({
    unauthenticatedUrl: new URL("/", req.url).href,
  });
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/__clerk/:path*",
    "/(api|trpc)(.*)",
  ],
};
