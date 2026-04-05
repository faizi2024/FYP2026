'use client';

import { PageHeader } from '@/components/shared/page-header';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowRight, Scan, Shirt, User, RectangleHorizontal, Shield, WandSparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
// 1. IMPORT YOUR NEW COMPONENT
import SizePredictor from '@/components/try-on/SizePredictor'; 

const quickLinks = [
  // ... (keep your existing quickLinks array exactly as it is)
  {
    title: 'Browse Catalog',
    description: 'Explore our latest collection.',
    href: '/dashboard/catalog',
    icon: Shirt,
    color: 'text-accent',
  },
  {
    title: 'My Wardrobe',
    description: 'View your saved items.',
    href: '/dashboard/wardrobe',
    icon: RectangleHorizontal,
    color: 'text-orange-400',
  },
  {
    title: 'Virtual Try-On',
    description: 'See how it fits, instantly.',
    href: '/dashboard/try-on?tab=real-time-try-on',
    icon: Scan,
    color: 'text-primary',
  },
  {
    title: 'AI Suggestions',
    description: 'Get outfit ideas from a photo.',
    href: '/dashboard/try-on?tab=photo-try-on',
    icon: WandSparkles,
    color: 'text-purple-400',
  },
  {
    title: 'Your Profile',
    description: 'Update your measurements.',
    href: '/dashboard/profile',
    icon: User,
    color: 'text-blue-400',
  },
  {
    title: 'Admin',
    description: 'Manage store garments.',
    href: '/dashboard/admin',
    icon: Shield,
    color: 'text-red-400',
  },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const userName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${userName}!`}
        description="Here's a quick overview of your virtual fitting room."
      />

      {/* 2. ADD THE SIZE PREDICTOR SECTION HERE */}
      <div className="mb-8">
        <SizePredictor />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((link) => (
          <Link href={link.href} key={link.title} className="group">
            <Card className="h-full p-6 flex flex-col justify-between transition-all duration-300 ease-in-out bg-card/90 dark:border-slate-700 dark:bg-slate-800/90 hover:border-primary/50 hover:shadow-lg dark:hover:shadow-primary/10">
              <div>
                <div className="flex items-center gap-4">
                  <div className={cn('p-2 bg-secondary rounded-lg', link.color)}>
                    <link.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-headline text-lg font-bold">{link.title}</h3>
                </div>
                <p className="mt-2 text-muted-foreground">{link.description}</p>
              </div>
              <div className="mt-4 flex justify-end">
                  <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}