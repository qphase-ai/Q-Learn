"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 backdrop-blur-md",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

// Active state uses a plain data-[state=active] fill (cyan pill) rather than a Framer
// Motion `layoutId` shared-element indicator, to keep this primitive simple and robust.
const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-cyber-cyan/60 disabled:pointer-events-none disabled:opacity-50",
      "hover:text-foreground",
      "data-[state=active]:bg-cyber-cyan data-[state=active]:text-background data-[state=active]:shadow-glow-cyan data-[state=active]:hover:text-background",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-3 outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan/60", className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
