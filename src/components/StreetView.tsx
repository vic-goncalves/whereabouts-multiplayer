import { useEffect, useEffectEvent, useRef, useState } from "react";
import { getStreetView } from "../google";
import type { Location, Movement } from "../types";
import { CheckpointIcon, FlagIcon, MinusIcon, PlusIcon, UndoIcon } from "./icons";
import { useAttached } from "./useAttached";

type Props = { location: Location; movement: Movement; interactive: boolean };

const MAX_ZOOM = 4;

export function StreetView({ location, movement, interactive }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { panorama, el } = getStreetView();
  useAttached(ref, el);

  const canMove = movement === "moving";
  const locked = movement === "nmpz";
  // A round is identified by its starting panorama, not by the `location`
  // object: party clients get a fresh copy of it with every server update
  // (e.g. whenever someone locks in), and that must not reset anyone's walk.
  const { panoId: startPano, heading: startHeading } = location;

  const [heading, setHeading] = useState(startHeading);
  const [canUndo, setCanUndo] = useState(false);
  const [checkpoint, setCheckpoint] = useState<string>();
  const current = useRef(startPano);
  const history = useRef<string[]>([]);
  // Set right before we call setPano ourselves, so the pano_changed listener
  // can tell our jumps apart from the player walking.
  const jumpingTo = useRef<string>(undefined);

  useEffect(() => {
    current.current = startPano;
    history.current = [];
    jumpingTo.current = undefined;
    setCanUndo(false);
    setCheckpoint(undefined);
    setHeading(startHeading);

    panorama.setOptions({
      linksControl: canMove,
      clickToGo: canMove,
      scrollwheel: !locked,
      disableDoubleClickZoom: !canMove,
    });
    panorama.setPano(startPano);
    panorama.setPov({ heading: startHeading, pitch: 0 });
    panorama.setZoom(0);

    const panoListener = panorama.addListener("pano_changed", () => {
      const pano = panorama.getPano();
      if (pano === current.current) return;
      if (pano === jumpingTo.current) {
        jumpingTo.current = undefined;
        current.current = pano;
        return;
      }
      if (!canMove) {
        // No Move: snap back if the panorama moved anyway (e.g. a stray keypress).
        panorama.setPano(current.current);
        return;
      }
      history.current.push(current.current);
      current.current = pano;
      setCanUndo(true);
    });
    const povListener = panorama.addListener("pov_changed", () => setHeading(panorama.getPov().heading));
    return () => {
      panoListener.remove();
      povListener.remove();
    };
  }, [panorama, startPano, startHeading, canMove, locked]);

  const jump = (pano: string, { record }: { record: boolean }) => {
    if (pano === current.current) return;
    if (record) history.current.push(current.current);
    jumpingTo.current = pano;
    panorama.setPano(pano);
    setCanUndo(history.current.length > 0);
  };

  const returnToStart = () => {
    jump(startPano, { record: true });
    panorama.setPov({ heading: startHeading, pitch: 0 });
  };
  const undo = () => {
    const previous = history.current.pop();
    if (previous) jump(previous, { record: false });
    setCanUndo(history.current.length > 0);
  };
  const toggleCheckpoint = () => {
    if (checkpoint && checkpoint !== current.current) jump(checkpoint, { record: true });
    else setCheckpoint(current.current);
  };
  const zoom = (delta: number) => panorama.setZoom(Math.min(MAX_ZOOM, Math.max(0, panorama.getZoom() + delta)));
  const faceNorth = () => {
    if (!locked) panorama.setPov({ heading: 0, pitch: panorama.getPov().pitch });
  };

  const onShortcut = useEffectEvent((key: string) => {
    if (key === "r") returnToStart();
    else if (key === "z") undo();
    else if (key === "c") toggleCheckpoint();
  });

  useEffect(() => {
    if (!interactive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Street View walks with the up/down arrows and turns with left/right.
      // Capture-phase handler so these never reach the panorama when blocked.
      const isWalk = e.key === "ArrowUp" || e.key === "ArrowDown";
      const isLook = e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "+" || e.key === "-" || e.key === "=";
      if ((isWalk && !canMove) || (isLook && locked)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (canMove) onShortcut(e.key.toLowerCase());
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [interactive, canMove, locked]);

  return (
    <div className="street-view">
      <div ref={ref} className="street-view__pano" />
      {locked && <div className="street-view__lock" />}
      {interactive && (
        <div className="sv-controls">
          <button className="compass" onClick={faceNorth} title={locked ? "Compass" : "Face north"} aria-label="Compass">
            <span className="compass__rose" style={{ transform: `rotate(${-heading}deg)` }}>
              <span className="compass__n">N</span>
              <span className="compass__needle" />
            </span>
          </button>
          {canMove && (
            <>
              <button className="sv-btn" onClick={returnToStart} title="Return to start (R)">
                <FlagIcon />
              </button>
              <button className="sv-btn" onClick={undo} disabled={!canUndo} title="Undo move (Z)">
                <UndoIcon />
              </button>
              <button
                className={`sv-btn ${checkpoint ? "sv-btn--active" : ""}`}
                onClick={toggleCheckpoint}
                title={checkpoint ? "Return to checkpoint (C)" : "Set checkpoint (C)"}
              >
                <CheckpointIcon />
              </button>
            </>
          )}
          {!locked && (
            <div className="sv-zoom">
              <button className="sv-btn" onClick={() => zoom(1)} title="Zoom in">
                <PlusIcon />
              </button>
              <button className="sv-btn" onClick={() => zoom(-1)} title="Zoom out">
                <MinusIcon />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
