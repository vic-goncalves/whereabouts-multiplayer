import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import type { LatLng } from "./geo";
import type { FindPanorama } from "./locations";

export const API_KEY: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";

let loading: Promise<void> | undefined;

export function loadGoogleMaps(): Promise<void> {
  loading ??= (async () => {
    setOptions({ key: API_KEY, v: "weekly" });
    await Promise.all([importLibrary("maps"), importLibrary("streetView"), importLibrary("geometry")]);
  })();
  return loading;
}

// Google bills per StreetViewPanorama and per Map *instantiation*, so the app
// creates exactly one of each and moves their elements between screens.
let streetView: { panorama: google.maps.StreetViewPanorama; el: HTMLElement } | undefined;
let map: google.maps.Map | undefined;

export function getStreetView(): { panorama: google.maps.StreetViewPanorama; el: HTMLElement } {
  if (!streetView) {
    const el = document.createElement("div");
    el.className = "gm-host";
    const panorama = new google.maps.StreetViewPanorama(el, {
      addressControl: false,
      showRoadLabels: false,
      fullscreenControl: false,
      enableCloseButton: false,
      imageDateControl: false,
      motionTracking: false,
      motionTrackingControl: false,
      panControl: false,
      zoomControl: false,
      disableDefaultUI: true,
      visible: true,
    });
    streetView = { panorama, el };
  }
  return streetView;
}

// The guess map keeps country, city and road names (the panorama is what hides
// them) but drops business and transit clutter. JSON styles only apply to maps
// without a mapId, which is also why markers are OverlayViews rather than
// AdvancedMarkerElements.
const GUESS_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ saturation: -100 }, { lightness: 30 }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#a8d4f0" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#eef0e6" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#8a8fa3" }, { weight: 1 }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#b9bccb" }, { weight: 0.6 }] },
];

export function getGuessMap(): google.maps.Map {
  if (!map) {
    const el = document.createElement("div");
    el.className = "gm-host";
    map = new google.maps.Map(el, {
      center: { lat: 20, lng: 0 },
      zoom: 1,
      minZoom: 1,
      styles: GUESS_MAP_STYLE,
      disableDefaultUI: true,
      clickableIcons: false,
      keyboardShortcuts: false,
      gestureHandling: "greedy",
      draggableCursor: "crosshair",
      backgroundColor: "#a8d4f0",
    });
  }
  return map;
}

let service: google.maps.StreetViewService | undefined;

export const findPanorama: FindPanorama = async (location, radius) => {
  service ??= new google.maps.StreetViewService();
  try {
    const { data } = await service.getPanorama({
      location,
      radius,
      sources: [google.maps.StreetViewSource.GOOGLE, google.maps.StreetViewSource.OUTDOOR],
      preference: google.maps.StreetViewPreference.NEAREST,
    });
    const latLng = data.location?.latLng;
    const panoId = data.location?.pano;
    if (!latLng || !panoId) return null;
    return {
      lat: latLng.lat(),
      lng: latLng.lng(),
      panoId,
      copyright: data.copyright ?? "",
      linkHeadings: (data.links ?? []).flatMap((link) => (link.heading == null ? [] : [link.heading])),
    };
  } catch (error) {
    if ((error as { code?: string }).code === google.maps.StreetViewStatus.ZERO_RESULTS) return null;
    throw error;
  }
};

let HtmlMarker: (new (position: LatLng, el: HTMLElement) => google.maps.OverlayView) | undefined;

// A DOM element pinned to a lat/lng. CSS decides which part of the element
// sits on the point (see .pin in styles.css).
export function createHtmlMarker(position: LatLng, el: HTMLElement): google.maps.OverlayView {
  HtmlMarker ??= class extends google.maps.OverlayView {
    position: LatLng;
    el: HTMLElement;
    constructor(position: LatLng, el: HTMLElement) {
      super();
      this.position = position;
      this.el = el;
      el.style.position = "absolute";
      google.maps.OverlayView.preventMapHitsAndGesturesFrom(el);
    }
    onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(this.el);
    }
    draw() {
      const point = this.getProjection()?.fromLatLngToDivPixel(this.position);
      if (!point) return;
      this.el.style.left = `${point.x}px`;
      this.el.style.top = `${point.y}px`;
    }
    onRemove() {
      this.el.remove();
    }
  };
  return new HtmlMarker(position, el);
}

export function streetViewUrl(panoId: string, heading: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&pano=${encodeURIComponent(panoId)}&heading=${Math.round(heading)}`;
}
