import { useEffect, useRef } from "react";
import type { Bounds, Countries } from "../countries";
import type { LatLng } from "../geo";
import { createHtmlMarker, getGuessMap } from "../google";
import { useAttached } from "./useAttached";

export type Pin = {
  position: LatLng;
  kind: "guess" | "actual";
  label?: string;
  href?: string;
  title?: string;
};

export type CountryShade = { iso: string; kind: "selected" | "correct" | "wrong" };

export type Scene = {
  pins: Pin[];
  lines: [LatLng, LatLng][];
  shades: CountryShade[];
  // The map refits whenever `fit.key` changes, so re-renders don't undo the
  // player's own panning and zooming.
  fit: { key: string; bounds?: Bounds; points?: LatLng[] };
};

type Props = {
  scene: Scene;
  countries: Countries;
  onClick?: (position: LatLng) => void;
};

const SHADE_COLORS: Record<CountryShade["kind"], string> = {
  selected: "#7c5cff",
  correct: "#3ecf6e",
  wrong: "#ff4d6d",
};

export function MapView({ scene, countries, onClick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const map = getGuessMap();
  useAttached(ref, map.getDiv());

  const onClickRef = useRef(onClick);
  useEffect(() => {
    onClickRef.current = onClick;
    map.setOptions({ draggableCursor: onClick ? "crosshair" : "grab" });
  }, [map, onClick]);

  useEffect(() => {
    const listener = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (e.latLng) onClickRef.current?.({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    });
    map.data.setStyle((feature) => {
      const color = SHADE_COLORS[feature.getProperty("kind") as CountryShade["kind"]];
      return { fillColor: color, fillOpacity: 0.35, strokeColor: color, strokeWeight: 2, clickable: false };
    });
    return () => listener.remove();
  }, [map]);

  useEffect(() => {
    const overlays: { setMap(m: google.maps.Map | null): void }[] = [];

    for (const [from, to] of scene.lines) {
      overlays.push(
        new google.maps.Polyline({
          map,
          path: [from, to],
          geodesic: true,
          clickable: false,
          strokeOpacity: 0,
          icons: [
            {
              icon: { path: "M 0,-1 0,1", strokeOpacity: 0.9, strokeColor: "#1b1640", scale: 2.5 },
              offset: "0",
              repeat: "10px",
            },
          ],
        }),
      );
    }

    for (const pin of scene.pins) {
      const marker = createHtmlMarker(pin.position, pinElement(pin));
      marker.setMap(map);
      overlays.push(marker);
    }

    const shaded = scene.shades.flatMap(({ iso, kind }) => {
      const country = countries.get(iso);
      if (!country) return [];
      return map.data.addGeoJson({ ...country.feature, properties: { ...country.feature.properties, kind } });
    });

    return () => {
      overlays.forEach((o) => o.setMap(null));
      shaded.forEach((f) => map.data.remove(f));
    };
  }, [map, countries, scene.pins, scene.lines, scene.shades]);

  const { key, bounds, points } = scene.fit;
  useEffect(() => {
    // The container may have just changed size. Google picks that up from a
    // ResizeObserver after layout, so wait two frames before fitting.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (points?.length) {
          const b = new google.maps.LatLngBounds();
          for (const p of points) {
            b.extend(p);
            // Keeps a single point (or two very close ones) from zooming to street level.
            b.extend({ lat: p.lat + 1, lng: p.lng + 1 });
            b.extend({ lat: p.lat - 1, lng: p.lng - 1 });
          }
          map.fitBounds(b, 50);
        } else if (bounds) {
          map.fitBounds(bounds, 0);
        } else {
          map.setCenter({ lat: 20, lng: 0 });
          map.setZoom(1);
        }
      });
    });
    return () => cancelAnimationFrame(frame);
    // Only `key` decides when to refit; see Scene.fit.
  }, [map, key]);

  return <div ref={ref} className="map-view" />;
}

function pinElement(pin: Pin): HTMLElement {
  const el = document.createElement(pin.href ? "a" : "div");
  el.className = `pin pin--${pin.kind}`;
  if (pin.title) el.title = pin.title;
  if (pin.href && el instanceof HTMLAnchorElement) {
    el.href = pin.href;
    el.target = "_blank";
    el.rel = "noopener";
  }
  const head = document.createElement("span");
  head.className = "pin__head";
  head.textContent = pin.label ?? "";
  el.append(head);
  return el;
}
