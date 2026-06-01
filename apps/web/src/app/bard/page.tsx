import { AuthGate } from "@/components/auth/AuthGate";
import { RoomShell } from "@/components/RoomShell";
import { BardStage } from "./BardStage";

export default function BardPage() {
  return (
    <AuthGate>
      <RoomShell
        title="The Bard's Stage"
        subtitle="A song for every feat, party, and rumor of the realm."
      >
        <BardStage />
      </RoomShell>
    </AuthGate>
  );
}
