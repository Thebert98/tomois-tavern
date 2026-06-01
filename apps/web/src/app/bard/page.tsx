import { RoomShell } from "@/components/RoomShell";

export default function BardPage() {
  return (
    <RoomShell
      title="The Bard's Stage"
      subtitle="A song for every feat, party, and rumor of the realm."
    >
      <p className="max-w-2xl text-tavern-parchment/80">
        Coming soon: tell the bard who or what to sing of. Claude pens the
        lyrics, Suno performs them, and the track lands on your shelf.
      </p>
    </RoomShell>
  );
}
