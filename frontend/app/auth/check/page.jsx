"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import FullPageStatus from "../../components/shell/FullPageStatus";
import { HOME_BY_ROLE } from "../../shell/menus";

export default function AuthCheckPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();

  const router = useRouter();

  const [message, setMessage] = useState(
    "Verifying your account..."
  );

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      router.replace("/");
      return;
    }

    const verifyUser = async () => {
      try {
        setMessage("Verifying your college account...");

        const token = await getToken();

        if (!token) {
          throw new Error(
            "Unable to obtain authentication token."
          );
        }

        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/api/users/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const user = response.data?.data;

        if (!user) {
          throw new Error(
            "User information not found."
          );
        }

        console.log("Verified user:", user);
        console.log("Role:", user.role);

        // ==========================================
        // ROLE BASED REDIRECTION
        // ==========================================
const home = HOME_BY_ROLE[user.role];
if (home) {
  router.replace(home);
} else {
  switch (user.role) {
  case "student":
    setMessage("Students do not sign in here. Results are published on the results page.");
    await signOut();
    setTimeout(() => router.replace("/"), 2500);
    break;

  default:
    setMessage("Your account has an invalid role.");
    await signOut();
    setTimeout(() => router.replace("/"), 1500);
  }
}
      } catch (error) {
        console.error(
          "Authentication verification failed:",
          error
        );

        const serverMessage = error.response?.data?.message;

        if (error.response?.status === 403 && serverMessage) {
          // NOT_REGISTERED / DEACTIVATED: show the backend's reason
          setMessage(serverMessage);
        } else if (error.response?.status === 404) {
          setMessage(
            "Your Clerk account exists, but you are not registered in the college system."
          );
        } else if (error.response?.status === 401) {
          setMessage(
            "Authentication failed. Please sign in again."
          );
        } else {
          setMessage(
            "Unable to verify your account. Please try again."
          );
        }

        await signOut();

        setTimeout(() => {
          router.replace("/");
        }, 2000);
      }
    };

    verifyUser();
  }, [
    isLoaded,
    isSignedIn,
    getToken,
    signOut,
    router,
  ]);

  return <FullPageStatus message={message} />;
}