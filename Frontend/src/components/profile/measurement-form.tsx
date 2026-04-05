'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { useState } from 'react';

const formSchema = z.object({
  heightCm: z.coerce.number().positive({ message: 'Must be a positive number.' }),
  weightKg: z.coerce.number().positive({ message: 'Must be a positive number.' }),
  chestCm: z.coerce.number().positive({ message: 'Must be a positive number.' }),
  waistCm: z.coerce.number().positive({ message: 'Must be a positive number.' }),
});

export function MeasurementsForm() {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      heightCm: user?.measurements?.heightCm || 0,
      weightKg: user?.measurements?.weightKg || 0,
      chestCm: user?.measurements?.chestCm || 0,
      waistCm: user?.measurements?.waistCm || 0,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
        updateUser({ measurements: values });
        setLoading(false);
    }, 500);
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
        <div className="flex justify-end">
            <Button type="submit" disabled={loading} className="font-bold">
            {loading ? 'Saving...' : 'Save Changes'}
            </Button>
        </div>
      </form>
    </Form>
  );
}
