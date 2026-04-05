'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/auth-context';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '@/hooks/use-toast';

// 1. Validation Schema
const formSchema = z.object({
  heightCm: z.coerce.number().positive({ message: 'Must be a positive number.' }),
  weightKg: z.coerce.number().positive({ message: 'Must be a positive number.' }),
  chestCm: z.coerce.number().positive({ message: 'Must be a positive number.' }),
  waistCm: z.coerce.number().positive({ message: 'Must be a positive number.' }),
});

export function MeasurementsForm() {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      heightCm: 0,
      weightKg: 0,
      chestCm: 0,
      waistCm: 0,
    },
  });

  // 2. Sync form with User Context when data arrives
  useEffect(() => {
    if (user?.measurements) {
      form.reset({
        heightCm: user.measurements.heightCm || 0,
        weightKg: user.measurements.weightKg || 0,
        chestCm: user.measurements.chestCm || 0,
        waistCm: user.measurements.waistCm || 0,
      });
    }
  }, [user, form]);

  // 3. Submit to Backend
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Ensure this matches your backend port (usually 5000)
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

      // NOTE: We use /users/profile because your backend router is likely 
      // mounted as app.use('/api/users', authRoutes)
      // 1. Send to Backend
// Make sure this matches your index.js base path (/api/auth)
      const response = await axios.patch(
        `${API_URL}/auth/profile`, 
        { measurements: values },
        { 
          headers: { 
            Authorization: `Bearer ${token}` 
        } 
      }
    );

      // Update local state so Try-On page unlocks immediately
      updateUser({ measurements: values });

      toast({
        title: "Success!",
        description: "Measurements saved. Your virtual fit is ready.",
      });
    } catch (error: any) {
      console.error("Save error details:", error.response?.data || error.message);
      
      const errorMessage = error.response?.data?.error || "Failed to connect to server.";
      
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="heightCm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Height (cm)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="180" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="weightKg"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Weight (kg)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="75" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="chestCm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chest (cm)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="100" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="waistCm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Waist (cm)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="85" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
        <div className="flex justify-end pt-4">
            <Button 
              type="submit" 
              disabled={loading} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
        </div>
      </form>
    </Form>
  );
}