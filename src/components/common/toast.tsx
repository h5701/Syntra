"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Short-lived confirmation message. Clears itself after a few seconds. */
export function Toast({ message, onDone, placement = "bottom" }: { message: string | null; onDone: () => void; placement?: "bottom" | "top" }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3400);
    return () => clearTimeout(t);
  }, [message, onDone]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key={message}
          role="status"
          initial={{ opacity: 0, y: placement === "top" ? -12 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: placement === "top" ? -12 : 16 }}
          className={cn(
            "fixed z-[80] flex max-w-[calc(100vw-2rem)] items-center gap-2.5 rounded-xl border border-border bg-white px-4 py-3 text-sm font-medium shadow-lift",
            placement === "top" ? "top-[4.25rem] left-1/2 -translate-x-1/2" : "right-4 bottom-4",
          )}
        >
          <CheckCircle2 className="size-4 text-success" />
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
