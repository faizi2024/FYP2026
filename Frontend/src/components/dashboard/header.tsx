'use client';

import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';

interface DashboardHeaderProps {
  title: string;
}

export function DashboardHeader({ title }: DashboardHeaderProps) {
  const { isMobile } = useSidebar();
  
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        {isMobile && <SidebarTrigger />}
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
    </header>
  );
}
