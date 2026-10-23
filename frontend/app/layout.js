import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import Navbar from "./components/Navbar";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const googleVerification =
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

export const metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "CCTEK | Project & Billing Management",
    template: "%s | CCTEK",
  },

  description:
    "CCTEK is a project and billing management platform for managing project records, faculty assignments, work progress, service charges, invoices, receipts and financial reports.",

  applicationName: "CCTEK",

  keywords: [
    "CCTEK",
    "CCTEK project management",
    "project management software",
    "billing management software",
    "invoice management",
    "faculty work allocation",
    "project assignment tracking",
    "service charge management",
    "receipt management",
    "financial reporting",
  ],

  authors: [{ name: "CCTEK" }],
  creator: "CCTEK",
  publisher: "CCTEK",
  category: "Business Software",

  alternates: {
    canonical: "/",
  },

  openGraph: {
    type: "website",
    url: "/",
    siteName: "CCTEK",
    title: "CCTEK | Project & Billing Management",
    description:
      "Manage projects, assignments, billing records, receipts and financial reports in one place.",
    locale: "en_IN",
  },

  twitter: {
    card: "summary",
    title: "CCTEK | Project & Billing Management",
    description:
      "A centralized platform for project tracking, faculty assignments and billing management.",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  ...(googleVerification
    ? {
        verification: {
          google: googleVerification,
        },
      }
    : {}),
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b3534",
};

export default function RootLayout({ children }) {
  return (
    // After any sign-in (modal or /sign-in page) go to /auth/check, which
    // asks the API for the role and sends the user to their dashboard.
    <ClerkProvider
      signInForceRedirectUrl="/auth/check"
      signUpForceRedirectUrl="/auth/check"
      afterSignOutUrl="/"
    >
      <html lang="en" className={jakarta.variable}>
        <body className="min-h-screen bg-cc-bg text-cc-text antialiased">
          <Toaster position="top-center" richColors closeButton expand toastOptions={{ style: { fontSize: "14px" } }} />
          <Navbar />
          <main>{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}