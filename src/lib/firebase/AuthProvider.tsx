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

    // Pick up any pending redirect result from a previous signInWithRedirect call.
    // Must run before onAuthStateChanged so a fresh redirect isn't treated as a
    // cold load (which would flash the landing page momentarily).
    getRedirectResult(auth).catch((err) => {
      // Log but don't block — if there's no pending redirect this resolves null.
      if (err?.code !== "auth/no-current-user") {
        console.error("getRedirectResult failed:", err);
      }
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (nextUser) => {
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
    });

    // Cross-tab token sync: react to revocations / refreshes immediately.
    const unsubscribeToken = onIdTokenChanged(auth!, (nextUser) => {
      if (!nextUser) {
        useAppStore.getState().resetState();
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeToken();
    };
  }, []);

  const loginWithGoogle = async () => {
    if (!auth) throw new Error("Firebase is not configured.");
    const provider = new GoogleAuthProvider();
    // signInWithRedirect is more reliable in production than signInWithPopup:
    // popups are blocked by third-party cookie restrictions and some browsers.
    // The redirect result is picked up by getRedirectResult on next page load.
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
