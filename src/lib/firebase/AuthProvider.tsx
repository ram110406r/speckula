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
    await signInWithPopup(auth, provider);
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
