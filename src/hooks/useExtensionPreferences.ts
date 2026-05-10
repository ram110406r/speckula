import { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  subscribeToExtensionPreferences,
  updateExtensionPreferences,
  type ExtensionPreferences,
} from "@/lib/firebase/db";

interface UseExtensionPreferencesReturn {
  preferences: ExtensionPreferences | null;
  loading: boolean;
  update: (patch: Partial<Omit<ExtensionPreferences, "updatedAt">>) => Promise<void>;
}

export function useExtensionPreferences(): UseExtensionPreferencesReturn {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<ExtensionPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPreferences(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToExtensionPreferences(
      user.uid,
      (prefs) => {
        setPreferences(prefs);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [user]);

  const update = async (patch: Partial<Omit<ExtensionPreferences, "updatedAt">>) => {
    if (!user) return;
    await updateExtensionPreferences(user.uid, patch);
  };

  return { preferences, loading, update };
}
