"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  onIdTokenChanged,
  User,
  signInWithPopup,
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

    const unsubscribeAuth = onAuthStateChanged(auth, async (nextUser) => {
      // Always reflect the auth state in React first so the UI doesn't sit
      // on the landing page if a downstream Firestore write throws.
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
        // Surface, but don't keep the user on the loading screen — they're
        // signed in to Firebase even if our user-doc upsert had a transient
        // permissions/network failure.
        console.error("initializeUser failed:", error);
      } finally {
        setLoading(false);
      }
    });

    // Cross-tab token sync: react to revocations / refreshes immediately
    // instead of waiting for the in-tab token to expire (~1h).
    const unsubscribeToken = onIdTokenChanged(auth!, (nextUser) => {
      // We don't need to do anything with the token itself — Firebase JS
      // SDK keeps it cached. This listener guarantees that any code calling
      // `auth.currentUser?.getIdToken()` after the next tick sees the
      // refreshed token, and clears stale state if the user was revoked.
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
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      // popup-blocked / user-cancel surface as unhandled rejections without
      // this catch. Re-throw so the caller can show a toast if it wants to.
      console.error("Google sign-in failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (auth) await signOut(auth);
    } finally {
      // resetState even if signOut throws so the UI doesn't sit in a
      // half-authed state on flaky networks.
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
