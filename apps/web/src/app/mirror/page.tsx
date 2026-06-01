import { RoomShell } from "@/components/RoomShell";

export default function MirrorPage() {
  return (
    <RoomShell
      title="The Magic Mirror"
      subtitle="Look long enough and a portrait stares back."
    >
      <p className="max-w-2xl text-tavern-parchment/80">
        Coming soon: pick a character, write a prompt, and Flux 1.1 Pro paints
        them. Portraits land here and on the Round Table.
      </p>
    </RoomShell>
  );
}
