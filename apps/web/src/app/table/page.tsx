import { AuthGate } from "@/components/auth/AuthGate";
import { RoomShell } from "@/components/RoomShell";
import { RoundTable } from "./RoundTable";

export default function TablePage() {
  return (
    <AuthGate>
      <RoomShell
        title="The Round Table"
        subtitle="Your roster of heroes — across every campaign."
      >
        <RoundTable />
      </RoomShell>
    </AuthGate>
  );
}
