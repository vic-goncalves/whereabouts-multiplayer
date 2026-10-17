import { useState } from "react";
import type { Countries } from "../countries";
import type { LatLng } from "../geo";
import { CloseIcon, MapIcon, MinusIcon, PinIcon, PlusIcon } from "./icons";
import { MapView, type Scene } from "./MapView";
import { cls } from "./ui";

type Props = {
  // guessing: corner map you click on. full: results map across the top.
  // hidden: kept mounted (the map is a singleton) but invisible.
  mode: "guessing" | "full" | "hidden";
  scene: Scene;
  countries: Countries;
  onPlace?: (position: LatLng) => void;
  guessLabel: string;
  canGuess: boolean;
  onGuess(): void;
};

const MAX_SIZE = 3;

export function GuessPanel({ mode, scene, countries, onPlace, guessLabel, canGuess, onGuess }: Props) {
  const [size, setSize] = useState(1);
  const [pinned, setPinned] = useState(false);
  const [open, setOpen] = useState(false);
  // Phones show the map on demand; close it whenever a round ends.
  if (mode !== "guessing" && open) setOpen(false);

  const guessing = mode === "guessing";
  return (
    <>
      {guessing && (
        <button className="map-toggle" onClick={() => setOpen((o) => !o)} aria-label="Toggle map">
          {open ? <CloseIcon /> : <MapIcon />}
        </button>
      )}
      <div
        className={cls(
          "guess-map",
          `guess-map--size-${size}`,
          pinned && "guess-map--pinned",
          open && "guess-map--open",
          mode === "full" && "guess-map--full",
          mode === "hidden" && "guess-map--hidden",
        )}
      >
        {guessing && (
          <div className="guess-map__tools">
            <button onClick={() => setSize((s) => Math.min(MAX_SIZE, s + 1))} disabled={size === MAX_SIZE} title="Bigger map">
              <PlusIcon size={14} />
            </button>
            <button onClick={() => setSize((s) => Math.max(0, s - 1))} disabled={size === 0} title="Smaller map">
              <MinusIcon size={14} />
            </button>
            <button onClick={() => setPinned((p) => !p)} className={cls(pinned && "active")} title="Keep map open">
              <PinIcon size={14} />
            </button>
          </div>
        )}
        <MapView scene={scene} countries={countries} onClick={guessing ? onPlace : undefined} />
        {guessing && (
          <button className="btn btn--guess" disabled={!canGuess} onClick={onGuess}>
            {guessLabel}
          </button>
        )}
      </div>
    </>
  );
}
