const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/projects/dashboard/",
          "/accounts/",
          "/faculty/",
          "/approvals/",
          "/reports/",
          "/auth/",
          "/api/",
          "/sign-in/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}