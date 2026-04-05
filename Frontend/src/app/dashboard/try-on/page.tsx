'use client';
import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Upload, WandSparkles, Camera, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { garmentSuggestionFlow as generateGarmentSuggestions, GarmentSuggestionOutput } from '@/ai/flows/generate-garment-suggestions';
import { useToast } from '@/hooks/use-toast';
import { ProductCard } from '@/components/catalog/product-card';
import { MOCK_GARMENTS } from '@/lib/data';
import type { Garment } from '@/lib/types';
import Link from 'next/link';
import { WardrobeCarousel } from '@/components/try-on/wardrobe-carousel';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';


function PhotoTryOn() {
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<GarmentSuggestionOutput | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleFileChange = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setFileName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileChange(file);
    }
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileChange(file);
    }
  };

  const handleReset = () => {
    setImage(null);
    setFileName(null);
    setSuggestions(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGetSuggestions = async () => {
    if (!image || !user?.measurements) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please upload a photo and ensure your measurements are set in your profile.',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await generateGarmentSuggestions({
        ...user.measurements,
        pastTryOnHistory: 'User likes futuristic and minimalist styles. Prefers darker colors.', // Placeholder
      });
      setSuggestions(result);
    } catch (error) {
      console.error('Error getting suggestions:', error);
      toast({
        variant: 'destructive',
        title: 'AI Suggestion Failed',
        description: 'There was an error generating suggestions. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const getGarmentByName = (name: string): Garment | undefined => {
    return MOCK_GARMENTS.find(g => g.name.toLowerCase() === name.toLowerCase());
  };

  return (
    <Card className="glass-card w-full">
        <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left side: Upload */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold font-headline">1. Upload Your Photo</h2>
                     <div
                        className="relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-card/50 hover:bg-card/80 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept="image/png, image/jpeg, image/webp"
                            onChange={onFileSelect}
                        />
                        {image ? (
                            <>
                                <img src={image} alt="Uploaded preview" className="object-contain h-full w-full rounded-lg" />
                                <button onClick={(e) => { e.stopPropagation(); handleReset(); }} className="absolute top-2 right-2 bg-background/50 rounded-full p-1 text-foreground hover:bg-background">
                                    <X className="h-4 w-4" />
                                </button>
                                <div className="absolute bottom-2 bg-background/70 text-foreground text-xs px-2 py-1 rounded-md">{fileName}</div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                                <p className="mb-2 text-sm text-muted-foreground">
                                    <span className="font-semibold">Click to upload</span> or drag and drop
                                </p>
                                <p className="text-xs text-muted-foreground">PNG, JPG, WEBP (MAX. 10MB)</p>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-4">
                        <Button onClick={handleGetSuggestions} disabled={!image || loading} className="w-full font-bold">
                            {loading ? 'Getting Suggestions...' : 'Get Suggestions'}
                        </Button>
                        <Button onClick={handleReset} variant="outline" disabled={loading}>Reset</Button>
                    </div>
                </div>

                {/* Right side: Suggestions */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold font-headline">2. AI Suggestions</h2>
                    <div className="w-full h-full border-2 border-dashed rounded-lg bg-card/50 p-4 min-h-[20rem]">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <WandSparkles className="w-10 h-10 mb-4 animate-pulse text-primary" />
                                <p className="animate-pulse">Generating your outfit...</p>
                            </div>
                        ) : suggestions ? (
                             <div className="grid grid-cols-1 gap-4">
                                {suggestions.suggestions.slice(0, 2).map((suggestion) => {
                                    const garment = getGarmentByName(suggestion.garmentName);
                                    return garment ? (
                                        <ProductCard key={garment.id} product={garment} />
                                    ) : (
                                        <Card key={suggestion.garmentName} className="p-4 bg-background/50">
                                            <p className="font-bold">{suggestion.garmentName}</p>
                                            <p className="text-sm text-muted-foreground">{suggestion.styleNotes}</p>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <WandSparkles className="w-10 h-10 mb-4" />
                                <p>Your outfit suggestions will appear here.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
  );
}


function RealTimeTryOn() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const getCameraPermission = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                setHasCameraPermission(true);

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (error) {
                console.error('Error accessing camera:', error);
                setHasCameraPermission(false);
                toast({
                    variant: 'destructive',
                    title: 'Camera Access Denied',
                    description: 'Please enable camera permissions in your browser settings to use this app.',
                });
            }
        };

        getCameraPermission();
    }, [toast]);

    const wardrobeItems = MOCK_GARMENTS.slice(0, 5);

    return (
        <Card className="glass-card w-full overflow-hidden">
            <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Live Feed */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold font-headline">Live Feed</h2>
                        <div className="relative aspect-video bg-muted/20 rounded-lg overflow-hidden">
                             <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                             {hasCameraPermission === false && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                                    <Alert variant="destructive" className="max-w-sm">
                                        <Camera className="h-4 w-4" />
                                        <AlertTitle>Camera Access Required</AlertTitle>
                                        <AlertDescription>
                                            Please allow camera access in your browser to use the real-time try-on feature.
                                        </AlertDescription>
                                    </Alert>
                                </div>
                            )}
                            {hasCameraPermission === null && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                                    <p>Requesting camera permission...</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Wardrobe */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold font-headline">Wardrobe</h2>
                        <WardrobeCarousel items={wardrobeItems} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function TryOnLandingPageContent() {
    const searchParams = useSearchParams();
    const tab = searchParams.get('tab');
    const defaultTab = tab === 'photo-try-on' ? 'photo-try-on' : 'real-time-try-on';

    return (
        <div className="space-y-8">
            <PageHeader
                title="Virtual Try-On"
                description="Discover your next favorite outfit."
            />
            <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
                    <TabsTrigger value="real-time-try-on">
                         <Camera className="mr-2 h-4 w-4" />
                        Real-Time Try-On
                    </TabsTrigger>
                    <TabsTrigger value="photo-try-on">
                        <WandSparkles className="mr-2 h-4 w-4" />
                        AI Suggestions
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="real-time-try-on" className="mt-6">
                    <RealTimeTryOn />
                </TabsContent>
                <TabsContent value="photo-try-on" className="mt-6">
                   <PhotoTryOn />
                </TabsContent>
            </Tabs>
        </div>
    );
}


export default function TryOnLandingPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <TryOnLandingPageContent />
        </Suspense>
    );
}
