import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = "default",
  index = 0,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "accent";
  index?: number;
}) {
  const tones: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    danger: "bg-destructive/12 text-destructive",
    accent: "bg-accent/15 text-accent",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
    >
      <Card className="card-elevated flex h-full flex-row items-center gap-4 p-4">
        <div className={cn("grid size-11 shrink-0 place-items-center rounded-xl", tones[tone])}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-bold tracking-tight">{value}</p>
          {hint ? <p className="truncate text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
      </Card>
    </motion.div>
  );
}
