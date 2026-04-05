import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { Garment } from '@/lib/types';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Scan } from 'lucide-react';

interface ProductCardProps {
  product: Garment;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Card className="glass-card flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10">
      <CardHeader className="p-0">
        <div className="aspect-square relative">
            <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                className="object-cover"
                data-ai-hint={product.imageHint}
            />
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <CardTitle className="font-headline text-lg tracking-tight">{product.name}</CardTitle>
        <p className="text-sm text-muted-foreground">{product.type}</p>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex items-center justify-between">
        <p className="text-lg font-semibold text-accent">${product.price.toFixed(2)}</p>
        <Button asChild>
          <Link href={`/dashboard/try-on/${product.id}`}>
            <Scan className="mr-2 h-4 w-4" /> Try On
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
