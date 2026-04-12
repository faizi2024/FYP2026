'use client';

import { useAuth } from '@/contexts/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import React, { useEffect, useMemo } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import Logo from '@/components/shared/Logo';
import { SidebarNav } from '@/components/dashboard/sidebar-nav';
import { UserNav } from '@/components/dashboard/user-nav';
import { DashboardHeader } from '@/components/dashboard/header';
import LoadingIndicator from '@/components/loading-indicator';
import { Separator } from '@/components/ui/separator';
import { NAV_ITEMS } from '@/lib/nav-items';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  const currentPageTitle = useMemo(() => {
    if (pathname.startsWith('/dashboard/try-on/')) {
        return 'Virtual Try-On';
    }
    const activeItem = NAV_ITEMS.find(item => {
        return pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
    });
    return activeItem ? activeItem.label : 'Dashboard';
  }, [pathname]);

  if (loading || !user) {
    return <LoadingIndicator />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        {/* 'offcanvas' makes it slide completely away like Gemini */}
        <Sidebar collapsible="offcanvas" className="border-r border-border/40">
          <SidebarHeader className="p-4">
            <Logo />
          </SidebarHeader>
          <SidebarContent className="px-2">
            <SidebarNav />
          </SidebarContent>
          <Separator className="my-2 opacity-50" />
          <SidebarFooter className="p-4">
            <UserNav />
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col w-full min-h-screen transition-all duration-300 ease-in-out">
          {/* Main Sticky Header with 3-line trigger */}
          <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background/95 backdrop-blur px-6 sticky top-0 z-10">
            <SidebarTrigger className="h-9 w-9 hover:bg-accent transition-colors" />
            <Separator orientation="vertical" className="h-6" />
            <DashboardHeader title={currentPageTitle} />
          </header>
          
          <main className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}