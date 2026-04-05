'use client';

import type { Garment } from '@/lib/types';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Slider } from '../ui/slider';
import { Label } from '../ui/label';
import { FitAnalysis } from './fit-analysis';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { UserCheck, Upload, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import LoadingIndicator from '../loading-indicator';

export function TryOnClient({ product }: { product: Garment }) {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // States for Manual Adjustment
  const [scale, setScale] = useState(100);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [fitIssues, setFitIssues] = useState<string[]>([]);

  // States for AI Photo Try-On
  const [userImageFile, setUserImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  // Use either the uploaded photo or the placeholder
  const activeUserImage = useMemo(() => {
    return previewUrl || '/placeholders/user-placeholder.png'; 
  }, [previewUrl]);

  // Handle Image Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUserImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setAiResult(null); // Reset AI result when new photo is uploaded
    }
  };

  // Logic for the AI Backend Connection
  const handleAiTryOn = async () => {
    if (!userImageFile) return;
    setIsGenerating(true);

    try {
      const formData = new FormData();
      formData.append('image', userImageFile);
      formData.append('garmentUrl', product.imageUrl);

      const response = await fetch('/api/tryon', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setAiResult(data.outputUrl);
    } catch (error) {
      console.error("AI Generation failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Canvas Drawing Logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const userImg = new window.Image();
    userImg.src = aiResult || activeUserImage; // Show AI result if available
    
    const garmentImg = new window.Image();
    garmentImg.src = product.imageUrl;

    const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (userImg.complete) {
            const userAspectRatio = userImg.width / userImg.height;
            const canvasAspectRatio = canvas.width / canvas.height;
            let drawWidth, drawHeight, dx, dy;

            if (userAspectRatio > canvasAspectRatio) {
                drawWidth = canvas.width;
                drawHeight = canvas.width / userAspectRatio;
                dx = 0; dy = (canvas.height - drawHeight) / 2;
            } else {
                drawHeight = canvas.height;
                drawWidth = canvas.height * userAspectRatio;
                dx = (canvas.width - drawWidth) / 2; dy = 0;
            }
            ctx.drawImage(userImg, dx, dy, drawWidth, drawHeight);
        }

        // Only draw manual garment overlay if NOT showing an AI result
        if (garmentImg.complete && !aiResult) {
            const garmentScale = scale / 100;
            const gWidth = garmentImg.width * garmentScale;
            const gHeight = garmentImg.height * garmentScale;
            const gX = (canvas.width - gWidth) / 2 + offsetX;
            const gY = (canvas.height - gHeight) / 2 + offsetY;
            
            ctx.globalAlpha = 0.8;
            ctx.drawImage(garmentImg, gX, gY, gWidth, gHeight);
            ctx.globalAlpha = 1.0;
        }
    };
    
    userImg.onload = draw;
    garmentImg.onload = draw;
    draw();
  }, [scale, offsetX, offsetY, product.imageUrl, activeUserImage, aiResult]);

  if (!user?.measurements) {
    return (
      <div className="space-y-8">
        <PageHeader title={product.name} description={product.type} />
        <Alert variant="destructive">
          <UserCheck className="h-4 w-4" />
          <AlertTitle>Measurements Required</AlertTitle>
          <AlertDescription>Please update your profile to use Virtual Try-On.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title={`Try On: ${product.name}`} description={product.type} />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: PREVIEW AREA */}
        <div className="lg:col-span-2">
          <Card className="glass-card overflow-hidden border-primary/20">
            <CardContent className="p-4 relative">
              {isGenerating && (
                <div className="absolute inset-0 z-10 bg-background/60 flex flex-col items-center justify-center backdrop-blur-sm">
                   <LoadingIndicator />
                   <p className="mt-4 font-medium animate-pulse">AI is stitching your garment...</p>
                </div>
              )}
              <div className="aspect-[9/16] w-full max-w-lg mx-auto bg-muted/20 rounded-md overflow-hidden shadow-inner">
                <canvas ref={canvasRef} width="450" height="800" className="w-full h-full object-contain" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: CONTROLS */}
        <div className="space-y-6">
          {/* UPLOAD SECTION */}
          <Card className="glass-card border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="w-4 h-4" /> Upload Your Photo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative group cursor-pointer border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 hover:border-primary/50 transition-colors">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Click to upload a full-body photo</p>
                </div>
              </div>
              
              <Button 
                onClick={handleAiTryOn} 
                disabled={!userImageFile || isGenerating} 
                className="w-full gap-2 shadow-lg"
              >
                <Sparkles className="w-4 h-4" /> Generate AI Try-On
              </Button>
            </CardContent>
          </Card>

          {/* MANUAL ADJUSTMENTS (Only visible if not using AI result) */}
          {!aiResult && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Manual Adjustment</CardTitle>
                <CardDescription>Drag sliders to position the overlay.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Scale ({scale}%)</Label>
                  <Slider value={[scale]} onValueChange={(v) => setScale(v[0])} max={200} />
                </div>
                <div className="space-y-2">
                  <Label>Horizontal ({offsetX}px)</Label>
                  <Slider value={[offsetX]} onValueChange={(v) => setOffsetX(v[0])} min={-200} max={200} />
                </div>
                <div className="space-y-2">
                  <Label>Vertical ({offsetY}px)</Label>
                  <Slider value={[offsetY]} onValueChange={(v) => setOffsetY(v[0])} min={-200} max={200} />
                </div>
                {aiResult && (
                  <Button variant="outline" onClick={() => setAiResult(null)} className="w-full">
                    Reset to Manual
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          <FitAnalysis 
            userMeasurements={user.measurements} 
            garment={product}
            onFitResult={setFitIssues}
          />
        </div>
      </div>
    </div>
  );
}