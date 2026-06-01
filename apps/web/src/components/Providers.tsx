"use client";

import { Toaster } from "@tomois/ui";
import { AuthProvider } from "./auth/AuthProvider";
import { TavernHUD } from "./TavernHUD";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Toaster>
        <TavernHUD />
        {children}
      </Toaster>
    </AuthProvider>
  );
}
