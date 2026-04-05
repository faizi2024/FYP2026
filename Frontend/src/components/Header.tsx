import { Shirt } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Shirt className="h-6 w-6" />
          </div>
          <h1 className="font-headline text-2xl font-bold text-primary">
            Virtual Try-On
          </h1>
        </div>
      </div>
    </header>
  );
}
