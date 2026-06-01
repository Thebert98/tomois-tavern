import { Suspense } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { RoomShell } from "@/components/RoomShell";
import { Fireplace } from "./Fireplace";

export default function FireplacePage() {
  return (
    <AuthGate>
      <RoomShell
        title="The Fireplace"
        subtitle="Stoke the embers — lock what you love, reroll the rest."
      >
        <Suspense fallback={null}>
          <Fireplace />
        </Suspense>
      </RoomShell>
    </AuthGate>
  );
}
