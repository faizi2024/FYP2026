'use client';

import { useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Upload, WandSparkles, Camera, X, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MOCK_GARMENTS } from '@/lib/data';
import { WardrobeCarousel } from '@/components/try-on/wardrobe-carousel';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import LoadingIndicator from '@/components/loading-indicator';

// Renamed to avoid collision with the file name/exports
function PhotoTryOnModule() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      // Create a local URL for the browser to display the preview
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setResultImage(null);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileChange(file);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResultImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStartTryOn = async () => {
    if (!selectedFile) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('garment_id', 'tshirt_white_001'); // Ensure this exists in your AI-Service/garments/

    try {
      // Calling the Python FastAPI service
      const response = await fetch('http://localhost:8000/try-on', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('AI Service Unreachable');

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      setResultImage(imageUrl);
      
      toast({
        title: "Success!",
        description: "Garment fitted successfully.",
      });
    } catch (error) {
      console.error('Try-on failed:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Ensure FastAPI is running on port 8000.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-card w-full border-primary/20 shadow-xl">
      <CardContent className="p-6">
        {loading && <LoadingIndicator />}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs text-white">1</span>
              Upload Photo
            </h2>
            
            <div
              className="relative flex flex-col items-center justify-center w-full aspect-[3/4] border-2 border-dashed rounded-xl cursor-pointer bg-muted/30 hover:bg-muted/50 transition-all overflow-hidden"
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={onFileSelect} />
              
              {previewUrl ? (
                <div className="relative w-full h-full">
                  <img src={previewUrl} alt="User Preview" className="object-cover w-full h-full" />
                  <button onClick={(e) => { e.stopPropagation(); handleReset(); }} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center text-muted-foreground p-4 text-center">
                  <Upload className="w-12 h-12 mb-4 opacity-40" />
                  <p className="font-medium">Click to upload photo</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button onClick={handleStartTryOn} disabled={!selectedFile || loading}>
                {loading ? 'Processing...' : 'Start Try-On'}
              </Button>
              <Button onClick={handleReset} variant="outline" disabled={loading}>Reset</Button>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs text-white">2</span>
              AI Result
            </h2>
            
            <div className="w-full aspect-[3/4] border-2 border-dashed rounded-xl bg-card/40 flex items-center justify-center overflow-hidden relative">
              {resultImage ? (
                <div className="w-full h-full">
                  <img src={resultImage} alt="AI Result" className="object-cover w-full h-full" />
                  <div className="absolute bottom-4 left-4 right-4 bg-white/90 border rounded-lg p-2 flex items-center gap-2">
                    <CheckCircle2 className="text-green-500 h-4 w-4" />
                    <p className="text-xs font-bold text-black">Honest Sizing Fit</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center text-muted-foreground p-4 text-center">
                  <WandSparkles className={`w-12 h-12 mb-4 ${loading ? 'animate-pulse text-primary' : 'opacity-20'}`} />
                  <p>Result will appear here</p>
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

    // Re-implemented camera logic for safety
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            setHasCameraPermission(true);
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (err) {
            setHasCameraPermission(false);
            console.error(err);
        }
    };

    const wardrobeItems = MOCK_GARMENTS.slice(0, 5);

    return (
        <Card className="glass-card w-full overflow-hidden">
            <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold">Live Feed</h2>
                        <div className="relative aspect-video bg-muted/20 rounded-lg overflow-hidden flex items-center justify-center">
                            {hasCameraPermission ? (
                                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                            ) : (
                                <Button onClick={startCamera}>Enable Camera</Button>
                            )}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold">Wardrobe</h2>
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
        <div className="space-y-8 p-6">
            <PageHeader title="Virtual Try-On" description="Experience Honest Sizing Technology." />
            <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-col-md mx-auto">
                    <TabsTrigger value="real-time-try-on"><Camera className="mr-2 h-4 w-4" /> Live</TabsTrigger>
                    <TabsTrigger value="photo-try-on"><WandSparkles className="mr-2 h-4 w-4" /> Photo</TabsTrigger>
                </TabsList>
                <TabsContent value="real-time-try-on" className="mt-6"><RealTimeTryOn /></TabsContent>
                <TabsContent value="photo-try-on" className="mt-6"><PhotoTryOnModule /></TabsContent>
            </Tabs>
        </div>
    );
}

export default function TryOnLandingPage() {
    return (
        <Suspense fallback={<div>Loading Interface...</div>}>
            <TryOnLandingPageContent />
        </Suspense>
    );
}