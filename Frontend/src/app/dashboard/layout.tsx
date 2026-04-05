'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import React, { useEffect, useMemo } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
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
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <Logo />
          </SidebarHeader>
          <SidebarContent>
            <SidebarNav />
          </SidebarContent>
          <Separator className="my-2" />
          <SidebarFooter>
            <UserNav />
          </SidebarFooter>
        </Sidebar>
        <div className="flex flex-col w-full">
            <DashboardHeader title={currentPageTitle} />
            <main className="p-4 sm:p-6 lg:p-8 flex-1">
                {children}
            </main>
        </div>
    </SidebarProvider>
  );
}
