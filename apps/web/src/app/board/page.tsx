import { RoomShell } from "@/components/RoomShell";

export default function BoardPage() {
  return (
    <RoomShell
      title="The Notice Board"
      subtitle="Friends, parties, and open seats at the table."
    >
      <p className="max-w-2xl text-tavern-parchment/80">
        Coming soon: send friend requests, found a party, post a notice for a
        new adventurer. Invitations route here.
      </p>
    </RoomShell>
  );
}
