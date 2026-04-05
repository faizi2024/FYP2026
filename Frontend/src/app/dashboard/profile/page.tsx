import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MeasurementsForm } from "@/components/profile/measurement-form";

export default function ProfilePage() {
    return (
        <div className="space-y-8">
            <PageHeader
                title="Your Profile"
                description="Keep your measurements up to date for the most accurate fit."
            />
            <div className="max-w-2xl">
                 <Card className="glass-card">
                    <CardHeader>
                        <CardTitle className="font-headline">Body Measurements</CardTitle>
                        <CardDescription>
                            These values help us create a virtual model of you for try-ons.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <MeasurementsForm />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
