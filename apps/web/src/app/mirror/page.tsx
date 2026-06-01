import { AuthGate } from "@/components/auth/AuthGate";
import { RoomShell } from "@/components/RoomShell";
import { MirrorRoom } from "./MirrorRoom";

export default function MirrorPage() {
  return (
    <AuthGate>
      <RoomShell
        title="The Magic Mirror"
        subtitle="Look long enough and a portrait stares back."
      >
        <MirrorRoom />
      </RoomShell>
    </AuthGate>
  );
}
