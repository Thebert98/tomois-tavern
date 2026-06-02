import { AuthGate } from "@/components/auth/AuthGate";
import { RoomShell } from "@/components/RoomShell";
import { FireplaceWizard } from "./FireplaceWizard";

export default function FireplacePage() {
  return (
    <AuthGate>
      <RoomShell
        title="The Fireplace"
        subtitle="Step by step — the fire fills in everything you don't."
      >
        <FireplaceWizard />
      </RoomShell>
    </AuthGate>
  );
}
