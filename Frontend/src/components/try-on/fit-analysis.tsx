'use client';

import { summarizeStyleTrends} from "@/ai/flows/summerize-style-trend";
import { useAuth } from "@/hooks/use-auth";
import type { Garment, UserProfile } from "@/lib/types";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";

interface FitAnalysisProps {
    userMeasurements: NonNullable<UserProfile['measurements']>;
    garment: Garment;
    onFitResult: (issues: string[]) => void;
}

export function FitAnalysis({ userMeasurements, garment, onFitResult }: FitAnalysisProps) {
    const [summary, setSummary] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [issues, setIssues] = useState<{ area: string, diff: number }[]>([]);

    useEffect(() => {
        const analyzeFit = async () => {
            setLoading(true);
            const tolerance = 2; // cm
            let feedback = '';
            const detectedIssues: { area: string, diff: number }[] = [];

            if (garment.measurements.chestCm > 0) {
                const chestDiff = userMeasurements.chestCm - garment.measurements.chestCm;
                if (chestDiff > tolerance) {
                    feedback += `Chest is tight by ${chestDiff.toFixed(1)}cm. `;
                    detectedIssues.push({ area: 'Chest', diff: chestDiff });
                }
            }

            if (garment.measurements.waistCm > 0) {
                const waistDiff = userMeasurements.waistCm - garment.measurements.waistCm;
                if (waistDiff > tolerance) {
                    feedback += `Waist is tight by ${waistDiff.toFixed(1)}cm. `;
                    detectedIssues.push({ area: 'Waist', diff: waistDiff });
                }
            }
            
            setIssues(detectedIssues);
            onFitResult(detectedIssues.map(i => i.area));

            if (feedback) {
                try {
                    const result = await summarizeFitFeedback({ feedback });
                    setSummary(result.summary);
                } catch (error) {
                    console.error("AI feedback summarization failed:", error);
                    setSummary("Could not generate AI summary. Garment may be tight in some areas.");
                }
            } else {
                setSummary("Looks like a great fit!");
            }
            setLoading(false);
        };

        analyzeFit();
    }, [userMeasurements, garment, onFitResult]);

    return (
        <Card className="glass-card">
            <CardHeader>
                <CardTitle className="font-headline">Honest Fit™ Analysis</CardTitle>
                <CardDescription>Our AI-powered analysis of how this garment fits you.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                ) : (
                    <div className="flex items-start gap-3">
                        {issues.length > 0 ? (
                           <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-1" />
                        ) : (
                            <CheckCircle2 className="h-6 w-6 text-accent flex-shrink-0 mt-1" />
                        )}
                        <div>
                            <p className="font-semibold">{summary}</p>
                            {issues.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {issues.map(issue => (
                                        <Badge key={issue.area} variant="destructive">
                                            {issue.area} Tight
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
