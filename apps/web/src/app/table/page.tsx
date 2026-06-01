import { RoomShell } from "@/components/RoomShell";

export default function TablePage() {
  return (
    <RoomShell
      title="The Round Table"
      subtitle="Your roster of heroes — across every campaign."
    >
      <p className="max-w-2xl text-tavern-parchment/80">
        Coming soon: every character you&apos;ve ever rolled, shown with their
        portraits and current party.
      </p>
    </RoomShell>
  );
}
