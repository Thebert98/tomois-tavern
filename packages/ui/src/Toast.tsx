"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { cn } from "./cn";

type Tone = "success" | "error" | "info";
interface ToastItem {
  id: string;
  message: ReactNode;
  tone: Tone;
}

interface ToastContextValue {
  toast: (message: ReactNode, opts?: { tone?: Tone; durationMs?: number }) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function Toaster({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const handle = timeouts.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timeouts.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (
      message: ReactNode,
      opts: { tone?: Tone; durationMs?: number } = {},
    ) => {
      const id = crypto.randomUUID();
      const tone = opts.tone ?? "info";
      setItems((list) => [...list, { id, message, tone }]);
      const handle = setTimeout(() => dismiss(id), opts.durationMs ?? 4200);
      timeouts.current.set(id, handle);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-4 right-4 z-[120] flex w-full max-w-xs flex-col gap-2"
      >
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
              className={cn(
                "pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 shadow-2xl backdrop-blur",
                item.tone === "success" &&
                  "border-tavern-moss/60 bg-tavern-night/85 text-tavern-parchment",
                item.tone === "error" &&
                  "border-tavern-blood/60 bg-tavern-night/85 text-tavern-parchment",
                item.tone === "info" &&
                  "border-tavern-gold/40 bg-tavern-night/85 text-tavern-parchment",
              )}
            >
              <ToneIcon tone={item.tone} />
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="flex-1 text-left text-xs italic text-tavern-parchment/85 hover:text-tavern-gold"
              >
                {item.message}
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToneIcon({ tone }: { tone: Tone }) {
  const cls = "mt-0.5 h-4 w-4 shrink-0";
  if (tone === "success") return <CheckCircle2 className={cn(cls, "text-tavern-moss")} />;
  if (tone === "error") return <AlertTriangle className={cn(cls, "text-tavern-blood")} />;
  return <Info className={cn(cls, "text-tavern-gold")} />;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <Toaster>");
  }
  return ctx;
}
