import { type LucideIcon } from "lucide-react";
import { SpotlightCard } from "@/components/effects";
import { CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Tailwind text-color class for the icon, e.g. "text-cyber-cyan" */
  accentClass: string;
  /** Tailwind border-color class, e.g. "border-cyber-cyan/20" */
  borderClass: string;
}

export function FeatureCard({ icon: Icon, title, description, accentClass, borderClass }: FeatureCardProps) {
  return (
    <SpotlightCard className={cn("border", borderClass)}>
      <CardContent className="flex flex-col gap-3 p-5">
        <Icon className={cn("h-6 w-6", accentClass)} aria-hidden="true" />
        <p className="text-base font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </SpotlightCard>
  );
}
