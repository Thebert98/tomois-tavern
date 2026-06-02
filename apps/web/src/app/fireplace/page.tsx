import { AuthGate } from "@/components/auth/AuthGate";
import { RoomShell } from "@/components/RoomShell";
import { Fireplace } from "./Fireplace";

export default function FireplacePage() {
  return (
    <AuthGate>
      <RoomShell
        title="The Fireplace"
        subtitle="Stoke the embers — speak a name, and a hero will step out of the fire."
      >
        <Fireplace />
      </RoomShell>
    </AuthGate>
  );
}
