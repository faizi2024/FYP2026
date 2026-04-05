'use client';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { NAV_ITEMS } from '@/lib/nav-items';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {NAV_ITEMS.map((item) => {
        // Active logic: checks if current path matches or starts with the item href
        const isActive = pathname === item.href || 
          (item.href !== '/dashboard' && pathname.startsWith(item.href));

        return (
          <SidebarMenuItem key={item.href}>
            {/* ✅ FIX: Remove legacyBehavior and passHref.
              Use asChild on SidebarMenuButton so it behaves like the Link.
            */}
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={item.label}
            >
              <Link href={item.href}>
                <item.icon className="text-primary [filter:drop-shadow(0_0_2px_hsl(var(--primary)))]" />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}