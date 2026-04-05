'use client';

import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import Image from 'next/image';
import { UploadCloud, CheckCircle, AlertCircle, Loader2, Sparkles, Shirt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getOutfitSuggestions } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';

export default function PhotoTryOn() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      processFile(droppedFile);
    } else {
      setError('Please drop an image file.');
    }
  };

  const processFile = (fileToProcess: File) => {
    setFile(fileToProcess);
    setError(null);
    setSuggestions([]);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(fileToProcess);
  };

  const handleSubmit = async () => {
    if (!preview) {
      toast({
        title: 'No Image Selected',
        description: 'Please upload an image first.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setSuggestions([]);
    setError(null);

    try {
      const result = await getOutfitSuggestions({ photoDataUri: preview });
      setSuggestions(result.suggestions);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setSuggestions([]);
    setError(null);
    setIsLoading(false);
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h2 className="font-headline text-2xl font-bold">1. Upload Your Photo</h2>
            <div
              className={cn(
                'relative flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
                isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50',
                preview ? 'border-solid' : 'border-dashed'
              )}
              onDragEnter={() => setIsDragging(true)}
              onDragLeave={() => setIsDragging(false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {preview ? (
                <Image src={preview} alt="Image preview" layout="fill" objectFit="contain" className="rounded-lg p-2" />
              ) : (
                <div className="text-center">
                  <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground">Drag & drop or click to upload</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WEBP up to 10MB</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
            {file && (
              <div className="flex items-center justify-between rounded-lg border bg-secondary/50 p-3">
                <p className="truncate text-sm">{file.name}</p>
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
            )}
            <div className="flex gap-4">
              <Button onClick={handleSubmit} disabled={!preview || isLoading} className="w-full">
                {isLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Get Suggestions
              </Button>
              <Button onClick={handleReset} variant="outline" className="w-full" disabled={!preview}>
                Reset
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-headline text-2xl font-bold">2. AI Suggestions</h2>
            <div className="h-full min-h-[300px] rounded-lg border bg-secondary/30 p-4">
              {isLoading && (
                <div className="space-y-4">
                  <p className="text-center text-muted-foreground">Our AI stylist is thinking...</p>
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              )}
              {!isLoading && suggestions.length > 0 && (
                <ul className="space-y-3">
                  {suggestions.map((item, index) => (
                    <li key={index} className="flex items-center gap-3 rounded-md bg-card p-3 shadow-sm">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <Shirt className="h-5 w-5" />
                      </div>
                      <span className="font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              )}
              {!isLoading && suggestions.length === 0 && !error && (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <Sparkles className="h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-muted-foreground">Your outfit suggestions will appear here.</p>
                </div>
              )}
              {error && (
                <div className="flex h-full flex-col items-center justify-center text-center text-destructive">
                  <AlertCircle className="h-12 w-12" />
                  <p className="mt-4 font-medium">An Error Occurred</p>
                  <p className="text-sm">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
