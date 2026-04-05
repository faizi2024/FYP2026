import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import Logo  from '@/components/shared/Logo'; // Fixed: Using named import and capitalized path
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function Home() {
  // Finding the hero image from your utility file
  const heroImage = PlaceHolderImages.find(p => p.id === 'hero-background');

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Background Image Section */}
      <div className="absolute inset-0 -z-10 h-full w-full">
        {heroImage && (
          <Image
            src={heroImage.imageUrl}
            alt={heroImage.description}
            fill
            priority // Added priority to load the hero image faster
            className="object-cover"
            data-ai-hint={heroImage.imageHint}
          />
        )}
        {/* Gradient Overlay for Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
      </div>

      {/* Navigation Header */}
      <header className="container mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <Logo />
        <div className='flex items-center gap-2'>
          <Button asChild variant="ghost">
            <Link href="/login">Log In</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Sign Up</Link>
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex items-center">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            {/* Announcement Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-sm text-primary mb-6">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>The future of fashion is here</span>
            </div>

            {/* Main Headline */}
            <h1 className="font-headline text-4xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Find Your Perfect Fit, Instantly
            </h1>

            {/* Subtext */}
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Welcome to VirtuFit, the revolutionary app that lets you try on
              clothes from the comfort of your home using our advanced virtual
              fitting room technology.
            </p>

            {/* Call to Action Buttons */}
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Button asChild size="lg" className="font-bold">
                <Link href="/signup">Get Started</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/catalog-preview">View Catalog</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} VirtuFit. All rights reserved.</p>
      </footer>
    </div>
  );
}