"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  onIdTokenChanged,
  User,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { auth } from "./config";
import { useAppStore } from "@/store/useAppStore";
import { initializeUser } from "./db";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  loginWithGoogle: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    let initializedFor: string | null = null;

    // Whether getRedirectResult has finished. We hold the loading state
    // until this resolves so a redirect-back doesn't flash the landing page
    // before Firebase processes the OAuth result.
    let redirectSettled = false;
    // Buffered auth state received while waiting for redirect result.
    // undefined = onAuthStateChanged hasn't fired yet.
    let bufferedUser: User | null | undefined = undefined;

    const settle = async (nextUser: User | null) => {
      setUser(nextUser);
      if (!nextUser) {
        initializedFor = null;
        useAppStore.getState().resetState();
        setLoading(false);
        return;
      }
      try {
        if (initializedFor !== nextUser.uid) {
          await initializeUser(nextUser.uid);
          initializedFor = nextUser.uid;
        }
      } catch (error) {
        console.error("initializeUser failed:", error);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (nextUser) => {
      if (!redirectSettled) {
        // Buffer until redirect result is known, to avoid flashing the landing
        // page for the brief moment before Firebase processes the redirect.
        bufferedUser = nextUser;
        return;
      }
      await settle(nextUser);
    });

    const unsubscribeToken = onIdTokenChanged(auth!, (nextUser) => {
      if (!nextUser) {
        useAppStore.getState().resetState();
      }
    });

    // Resolve any pending redirect sign-in before allowing the auth state
    // to propagate to the rest of the app.
    getRedirectResult(auth)
      .catch((err) => {
        if (err?.code !== "auth/no-current-user") {
          console.error("getRedirectResult failed:", err);
        }
      })
      .finally(async () => {
        redirectSettled = true;
        // If onAuthStateChanged already fired while we were waiting, process it now.
        if (bufferedUser !== undefined) {
          await settle(bufferedUser);
        }
        // If onAuthStateChanged hasn't fired yet, it will call settle() directly
        // because redirectSettled is now true.
      });

    return () => {
      unsubscribeAuth();
      unsubscribeToken();
    };
  }, []);

  const loginWithGoogle = async () => {
    if (!auth) throw new Error("Firebase is not configured.");
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
  };

  const logout = async () => {
    try {
      if (auth) await signOut(auth);
    } finally {
      useAppStore.getState().resetState();
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};
