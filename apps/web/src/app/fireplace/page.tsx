import { RoomShell } from "@/components/RoomShell";

export default function FireplacePage() {
  return (
    <RoomShell
      title="The Fireplace"
      subtitle="Stoke the embers — roll a hero."
    >
      <p className="max-w-2xl text-tavern-parchment/80">
        The character forge lives in <code>ReRoll</code>. We&apos;ll embed it
        here next — for now, click through to the standalone app while we wire
        up the bridge.
      </p>
    </RoomShell>
  );
}
