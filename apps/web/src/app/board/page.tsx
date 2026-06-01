import { AuthGate } from "@/components/auth/AuthGate";
import { RoomShell } from "@/components/RoomShell";
import { NoticeBoard } from "./NoticeBoard";

export default function BoardPage() {
  return (
    <AuthGate>
      <RoomShell
        title="The Notice Board"
        subtitle="Friends, parties, open seats at the table."
      >
        <NoticeBoard />
      </RoomShell>
    </AuthGate>
  );
}
