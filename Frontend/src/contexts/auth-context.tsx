'use client';

import type { UserProfile } from '@/lib/types';
import { useRouter } from 'next/navigation';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import LoadingIndicator from '@/components/loading-indicator';

// This is a mock authentication context.
// In a real application, you would replace this with Firebase Authentication.

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string) => void;
  signup: (email: string, name: string) => void;
  logout: () => void;
  updateUser: (profile: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MOCK_USER: UserProfile = {
  uid: '12345',
  email: 'user@virtufit.com',
  name: 'Alex Ryder',
  photoURL: 'https://i.pravatar.cc/150?u=a042581f4e29026704d',
  measurements: {
    heightCm: 180,
    weightKg: 75,
    chestCm: 100,
    waistCm: 85,
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Simulate checking for an existing session
    const session = sessionStorage.getItem('virtufit-user');
    if (session) {
      setUser(JSON.parse(session));
    }
    // Simulate loading delay
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const login = (email: string) => {
    setLoading(true);
    setTimeout(() => {
      const loggedInUser = { ...MOCK_USER, email };
      setUser(loggedInUser);
      sessionStorage.setItem('virtufit-user', JSON.stringify(loggedInUser));
      setLoading(false);
      router.push('/dashboard');
      toast({ title: 'Login Successful', description: `Welcome back, ${loggedInUser.name}!` });
    }, 500);
  };

  const signup = (email: string, name: string) => {
    setLoading(true);
    setTimeout(() => {
      const newUser = { ...MOCK_USER, email, name };
      setUser(newUser);
      sessionStorage.setItem('virtufit-user', JSON.stringify(newUser));
      setLoading(false);
      router.push('/dashboard');
      toast({ title: 'Account Created', description: `Welcome to VirtuFit, ${name}!` });
    }, 500);
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('virtufit-user');
    router.push('/');
    toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
  };
  
  const updateUser = (profile: Partial<UserProfile>) => {
    if (user) {
        const updatedUser = { ...user, ...profile };
        setUser(updatedUser);
        sessionStorage.setItem('virtufit-user', JSON.stringify(updatedUser));
        toast({ title: 'Profile Updated', description: 'Your information has been saved.' });
    }
  };

  const value = { user, loading, login, signup, logout, updateUser };

  if (loading) {
    return <LoadingIndicator />;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
