// Third pass: retry the ~15 shots that were SKIPped in batch 1+2 (no
// acceptable candidate found after 2 tries), with fresh query phrasings that
// avoid the specific traps identified: "tablet" matching pills, trench/chino
// colors that don't exist as real garments, stroller shots always showing a
// baby/parent, brand-name speakers/adapters.
import type { ProductPlan } from "./plan";

export const plan3: ProductPlan[] = [
  { slug: "car-bluetooth-adapter", title: "Car Bluetooth Adapter", shots: [
    { name: "hero", query: "bluetooth fm transmitter car charger" },
  ]},
  { slug: "chino-trousers", title: "Chino Trousers", shots: [
    { name: "white", query: "white linen pants flat lay" },
    { name: "blue", query: "navy chino pants folded product photo" },
  ]},
  { slug: "crossbody-bag", title: "Crossbody Bag", shots: [
    { name: "green", query: "olive green satchel bag product photo" },
  ]},
  { slug: "foam-roller", title: "Foam Roller", shots: [
    { name: "yellow", query: "orange foam roller fitness equipment" },
  ]},
  { slug: "high-waist-jeans", title: "High-Waist Jeans", shots: [
    { name: "white", query: "white denim pants studio photo" },
  ]},
  { slug: "knit-sweater", title: "Knit Sweater", shots: [
    { name: "red", query: "burgundy pullover sweater product photo" },
    { name: "blue", query: "navy pullover sweater product photo" },
  ]},
  { slug: "mini-tablet-8", title: "Mini Tablet 8", shots: [
    { name: "red", query: "red ipad tablet mockup" },
  ]},
  { slug: "slim-fit-jeans", title: "Slim Fit Jeans", shots: [
    { name: "green", query: "olive cargo pants studio photo" },
    { name: "white", query: "white denim jeans flat lay" },
  ]},
  { slug: "stroller-lite", title: "Stroller Lite", shots: [
    { name: "black", query: "empty stroller product photo studio" },
    { name: "white", query: "gray stroller folded studio photo" },
  ]},
  { slug: "studio-over-ear", title: "Studio Over-Ear", shots: [
    { name: "blue", query: "teal headphones product photo" },
  ]},
  { slug: "tablet-air-11", title: "Tablet Air 11", shots: [
    { name: "red", query: "red ipad tablet mockup" },
  ]},
];
