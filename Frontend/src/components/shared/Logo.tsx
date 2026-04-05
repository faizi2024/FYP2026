import Link from "next/link";
import { Move3d } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2 text-foreground transition-colors hover:text-primary", className)}
    >
      <div className="bg-primary text-primary-foreground p-2 rounded-lg">
        <Move3d className="h-5 w-5" />
      </div>
      <span className="font-headline text-xl font-bold tracking-wider">
        VirtuFit
      </span>
    </Link>
  );
}
