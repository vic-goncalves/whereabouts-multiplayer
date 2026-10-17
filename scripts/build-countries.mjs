// Builds public/countries.json (TopoJSON) from Natural Earth 1:50m admin-0 countries.
// Usage: node scripts/build-countries.mjs path/to/ne_50m_admin_0_countries.geojson
// Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const input = process.argv[2];
if (!input) {
  console.error("usage: node scripts/build-countries.mjs <ne_50m_admin_0_countries.geojson>");
  process.exit(1);
}

const output = fileURLToPath(new URL("../public/countries.json", import.meta.url));
const mapshaper = fileURLToPath(new URL("../node_modules/.bin/mapshaper", import.meta.url));

// Natural Earth marks a few disputed areas as -99. Fold them into the country
// Street View files them under, and drop the rest.
const disputed = { Somaliland: "SO", "N. Cyprus": "CY" };
const names = {
  CN: "China",
  CY: "Cyprus",
  CZ: "Czechia",
  TL: "Timor-Leste",
  US: "United States",
  BS: "Bahamas",
  GM: "Gambia",
  CD: "DR Congo",
  CG: "Congo",
  CI: "Côte d'Ivoire",
  MK: "North Macedonia",
  SZ: "Eswatini",
  FO: "Faroe Islands",
};

const each = [
  `iso = ISO_A2_EH === "-99" ? (${JSON.stringify(disputed)}[NAME] || "") : ISO_A2_EH`,
  `name = ${JSON.stringify(names)}[iso] || NAME_EN`,
].join("; ");

execFileSync(
  mapshaper,
  [
    input,
    "-each", each,
    "-filter", 'iso !== "" && iso !== "AQ"',
    "-dissolve", "iso", "copy-fields=name",
    "-simplify", "40%", "keep-shapes",
    "-filter-fields", "iso,name",
    "-rename-layers", "countries",
    "-o", output, "format=topojson", "quantization=100000", "id-field=iso",
  ],
  { stdio: "inherit" },
);
