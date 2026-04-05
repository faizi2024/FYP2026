import {
  LayoutDashboard,
  Shirt,
  User,
  Scan,
  Shield,
  RectangleHorizontal,
} from 'lucide-react';

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/catalog', label: 'Catalog', icon: Shirt },
  { href: '/dashboard/wardrobe', label: 'Wardrobe', icon: RectangleHorizontal },
  { href: '/dashboard/try-on', label: 'Try-On', icon: Scan },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
  { href: '/dashboard/admin', label: 'Admin', icon: Shield },
];
