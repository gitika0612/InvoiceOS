import { useAuth as useClerkAuth, useUser } from "@clerk/clerk-react";
import { useCallback } from "react";
import api from "@/lib/api";

export function useAuth() {
  const { getToken, signOut, isSignedIn, isLoaded } = useClerkAuth();
  const { user } = useUser();

  const syncUser = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getToken();
      await api.post(
        "/users/sync",
        {
          clerkId: user.id,
          email: user.primaryEmailAddress?.emailAddress,
          name: user.fullName || user.firstName || "",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.error("User sync failed:", err);
    }
  }, [user, getToken]);

  return {
    isSignedIn,
    isLoaded,
    user,
    signOut,
    syncUser,
  };
}
