'use client';

import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import placeholderData from '@/lib/placeholder-images.json';
import { useState } from 'react';

const clothingItems = placeholderData.placeholderImages.filter(img => img.id.startsWith('clothing-item-'));
const userPlaceholder = placeholderData.placeholderImages.find(img => img.id === 'user-placeholder');

export default function RealTimeTryOn() {
  const [selectedItem, setSelectedItem] = useState(clothingItems[0]);

  return (
    <Card className="w-full overflow-hidden">
      <CardContent className="p-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CardHeader className="p-0">
                <CardTitle className="font-headline text-2xl font-bold">Live Feed</CardTitle>
                <CardDescription>Our model is ready for a virtual fitting.</CardDescription>
            </CardHeader>
            <Card className="mt-4 aspect-[2/3] w-full max-w-lg mx-auto overflow-hidden shadow-lg">
              {userPlaceholder && (
                <Image
                  src={userPlaceholder.imageUrl}
                  alt={userPlaceholder.description}
                  data-ai-hint={userPlaceholder.imageHint}
                  width={400}
                  height={600}
                  className="h-full w-full object-cover"
                  priority
                />
              )}
            </Card>
          </div>

          <div className="flex flex-col">
            <CardHeader className="p-0">
                <CardTitle className="font-headline text-2xl font-bold">Wardrobe</CardTitle>
                <CardDescription>Select an item to try on.</CardDescription>
            </CardHeader>
            <div className="flex flex-1 flex-col items-center justify-center pt-4">
              <Carousel
                opts={{
                  align: 'start',
                }}
                className="w-full max-w-xs"
              >
                <CarouselContent>
                  {clothingItems.map((item) => (
                    <CarouselItem key={item.id} className="md:basis-1/2" onClick={() => setSelectedItem(item)}>
                        <Card className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow">
                          <CardContent className="flex aspect-square items-center justify-center p-0">
                            <Image
                              src={item.imageUrl}
                              alt={item.description}
                              data-ai-hint={item.imageHint}
                              width={400}
                              height={400}
                              className="h-full w-full object-cover"
                            />
                          </CardContent>
                        </Card>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>

              <Card className="mt-8 w-full max-w-xs">
                <CardHeader>
                    <CardTitle className="text-lg">{selectedItem.description}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">This is a conceptual demonstration. In a full version, this item would be overlaid on the live feed.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
