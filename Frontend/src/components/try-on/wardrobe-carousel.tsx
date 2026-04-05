"use client";

import * as React from "react";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { Garment } from "@/lib/types";

interface WardrobeCarouselProps {
  items: Garment[];
}

export function WardrobeCarousel({ items }: WardrobeCarouselProps) {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!api) {
      return;
    }

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  return (
    <div className="space-y-4">
      <Carousel setApi={setApi} className="w-full max-w-sm mx-auto">
        <CarouselContent>
          {items.map((item) => (
            <CarouselItem key={item.id} className="basis-1/2">
              <Card className="glass-card overflow-hidden">
                <CardContent className="p-0 flex aspect-square items-center justify-center">
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    width={200}
                    height={200}
                    className="object-cover"
                    data-ai-hint={item.imageHint}
                  />
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="-left-4" />
        <CarouselNext className="-right-4" />
      </Carousel>
      {items[current - 1] && (
        <Card className="glass-card">
          <CardContent className="p-4 space-y-2">
            <h3 className="font-semibold">{items[current - 1].name}</h3>
            <p className="text-sm text-muted-foreground">
              This is a conceptual demonstration. In a full version, this item
              would be overlaid on the live feed.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
