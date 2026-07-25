import path from "path";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
  Svg,
  Path,
  Circle,
} from "@react-pdf/renderer";

// Geist is the app's --font-sans; the Google Fonts static TTFs cover Latin
// Extended (Serbian č ć š ž đ, German umlauts, Spanish accents) which the
// built-in Helvetica does not. Served from the app's own public/ so the PDF
// doesn't depend on any package's internals at runtime.
Font.register({
  family: "Geist",
  fonts: [
    { src: path.join(process.cwd(), "public/fonts/Geist-Regular.ttf"), fontWeight: 400 },
    { src: path.join(process.cwd(), "public/fonts/Geist-Bold.ttf"), fontWeight: 700 },
  ],
});
// Invoices read better without hyphenation breaking words/numbers.
Font.registerHyphenationCallback((word) => [word]);

export type InvoiceLabels = {
  invoice: string;
  invoiceNo: string;
  issued: string;
  orderRef: string;
  orderDate: string;
  billTo: string;
  shipTo: string;
  item: string;
  seller: string;
  qty: string;
  unitPrice: string;
  lineTotal: string;
  subtotal: string;
  discount: string;
  shipping: string;
  total: string;
  footer: string;
};

export type InvoiceLine = {
  title: string;
  variantLabel: string | null;
  sellerName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  // PNG data-URI thumbnail (normalized server-side), or null if unavailable.
  image: string | null;
};

export type InvoiceData = {
  number: string; // formatted, e.g. INV-000123
  issuedAt: string;
  orderShortId: string;
  orderDate: string;
  buyer: { name: string | null; email: string };
  shipping: {
    name: string | null;
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
  lines: InvoiceLine[];
  // Subtotal is shown when there's a discount and/or shipping; each of those
  // lines is present only when it applies.
  subtotal: string | null;
  discount: string | null;
  shippingCost: string | null;
  couponCode: string | null;
  total: string;
  labels: InvoiceLabels;
};

// Brand-tinted neutrals: same lightness as the old zinc scale, with the faint
// cool/indigo cast of the MarketVerse palette.
const INK = "#14162b";
const MUTED = "#6e7186";
const FAINT = "#9a9db1";
const HAIR = "#e4e5ee";
/** Fixed dark brand tile - matches the app's logo backdrop (--card cosmos). */
const BRAND_TILE = "#0a0b1e";

const styles = StyleSheet.create({
  page: {
    // Top padding clears the full-bleed brand band (72pt) plus breathing room.
    paddingTop: 100,
    paddingBottom: 64,
    paddingHorizontal: 44,
    fontSize: 9.5,
    lineHeight: 1.4,
    color: "#3f4155",
    fontFamily: "Geist",
  },

  // Header - full-bleed deep-space band across the very top of the page
  // (edge to edge, square corners), mirroring the transactional-email header
  // strip: dark cosmos surface, mark + two-tone wordmark, stars everywhere.
  brandBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#040511",
    paddingHorizontal: 44,
  },
  bandLeft: { flexDirection: "row", alignItems: "center" },
  brand: { fontSize: 13, fontWeight: 700, color: "#f2eee7" },
  brandVerse: { color: "#9076f3" },
  brandSub: { fontSize: 8, color: FAINT, marginTop: 1 },

  invoiceTitle: { fontSize: 20, fontWeight: 700, color: "#c5cfdb", letterSpacing: 1 },
  metaWrap: { alignItems: "flex-end", marginTop: 0 },
  metaTable: { marginTop: 0 },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 2 },
  metaLabel: { fontSize: 8.5, color: FAINT, marginRight: 8 },
  metaValue: { fontSize: 8.5, color: INK, fontWeight: 700, minWidth: 88, textAlign: "right" },

  rule: { height: 1, backgroundColor: HAIR, marginTop: 22, marginBottom: 22 },

  // Parties
  parties: { flexDirection: "row", justifyContent: "space-between" },
  party: { width: "47%" },
  partyLabel: { fontSize: 8, color: FAINT, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 5 },
  partyName: { fontSize: 10.5, fontWeight: 700, color: INK, marginBottom: 2 },
  partyLine: { fontSize: 9.5, color: "#525569", marginBottom: 1 },

  // Table - clean, borderless, hairline-separated rows
  table: { marginTop: 26 },
  thead: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1.5, borderBottomColor: INK },
  th: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 },
  row: { flexDirection: "row", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#f0f0f6" },

  cItem: { width: "39%", paddingRight: 6, flexDirection: "row", alignItems: "center" },
  itemThumb: { width: 26, height: 26, borderRadius: 4, marginRight: 7, objectFit: "cover" },
  itemTextCol: { flex: 1 },
  cSeller: { width: "21%", paddingRight: 6 },
  cQty: { width: "8%", textAlign: "center" },
  cPrice: { width: "16%", textAlign: "right", paddingLeft: 4 },
  cTotal: { width: "16%", textAlign: "right", paddingLeft: 4 },

  itemTitle: { fontSize: 9.5, color: INK, fontWeight: 700 },
  itemVariant: { fontSize: 8, color: FAINT, marginTop: 1 },
  sellerText: { fontSize: 9, color: MUTED },
  num: { fontSize: 9.5, color: "#262940" },
  numStrong: { fontSize: 9.5, color: INK, fontWeight: 700 },

  // Totals
  totals: { flexDirection: "row", justifyContent: "flex-end", marginTop: 18 },
  totalBox: { width: "42%" },
  subtotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 6 },
  subtotalLabel: { fontSize: 9.5, color: MUTED },
  subtotalValue: { fontSize: 9.5, color: "#262940" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 2, borderTopColor: INK, paddingTop: 9 },
  totalLabel: { fontSize: 11, fontWeight: 700, color: INK },
  totalValue: { fontSize: 13, fontWeight: 700, color: INK },

  footer: {
    position: "absolute",
    bottom: 36,
    left: 44,
    right: 44,
    fontSize: 8,
    color: FAINT,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: HAIR,
    paddingTop: 12,
  },
});

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const l = data.labels;
  const addr = data.shipping;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header - dark cosmos band, mirrors the email header strip */}
        <View style={styles.brandBand}>
          {/* Star decoration across the full band width (A4 = 595pt), faint
              enough to sit behind the lockup and title without clashing. */}
          <Svg
            width={596}
            height={72}
            viewBox="0 0 596 72"
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            <Path d="M150 13 Q151.25 16.75 155 18 Q151.25 19.25 150 23 Q148.75 19.25 145 18 Q148.75 16.75 150 13 Z" fill="#d3d8de" fillOpacity={0.8} />
            <Path d="M300 46 Q301 49 304 50 Q301 51 300 54 Q299 51 296 50 Q299 49 300 46 Z" fill="#807cc6" fillOpacity={0.7} />
            <Path d="M360 9.5 Q361.15 12.85 364.5 14 Q361.15 15.15 360 18.5 Q358.85 15.15 355.5 14 Q358.85 12.85 360 9.5 Z" fill="#d3d8de" fillOpacity={0.75} />
            <Path d="M470 50.5 Q471 53.5 473.5 54 Q471 54.5 470 57.5 Q469 54.5 466.5 54 Q469 53.5 470 50.5 Z" fill="#807cc6" fillOpacity={0.6} />
            <Path d="M60 54.5 Q61 57.5 63.5 58 Q61 58.5 60 61.5 Q59 58.5 56.5 58 Q59 57.5 60 54.5 Z" fill="#d3d8de" fillOpacity={0.55} />
            <Path d="M555 16 Q556 19 559 20 Q556 21 555 24 Q554 21 551 20 Q554 19 555 16 Z" fill="#d3d8de" fillOpacity={0.6} />
            <Circle cx="30" cy="16" r="1.2" fill="#d3d8de" fillOpacity={0.5} />
            <Circle cx="100" cy="40" r="1.4" fill="#d3d8de" fillOpacity={0.5} />
            <Circle cx="200" cy="60" r="1.2" fill="#807cc6" fillOpacity={0.5} />
            <Circle cx="250" cy="12" r="1.4" fill="#d3d8de" fillOpacity={0.55} />
            <Circle cx="330" cy="32" r="1.6" fill="#d3d8de" fillOpacity={0.6} />
            <Circle cx="420" cy="10" r="1.2" fill="#807cc6" fillOpacity={0.5} />
            <Circle cx="520" cy="44" r="1.3" fill="#d3d8de" fillOpacity={0.5} />
            <Circle cx="585" cy="60" r="1.1" fill="#d3d8de" fillOpacity={0.45} />
          </Svg>
          <View style={styles.bandLeft}>
            {/* MarketVerse mark (comet + bag + stars) - keep in sync with
                BrandMark; the tail gradient is flattened to a solid at
                reduced opacity for reliable PDF rendering. */}
            <Svg width={26} height={26} viewBox="0 0 64 64">
              <Path d="M3 7 C20 8 34 12 44.2 17.8 L43.6 23.3 C32 18.5 17 12 3 7 Z" fill="#c9c7d0" fillOpacity={0.55} />
              <Circle cx="47" cy="20.5" r="4.2" fill="#f2eee7" />
              <Path d="M20 30 L44 30 L47.3 46.8 Q48 50 44.5 50 L19.5 50 Q16 50 16.7 46.8 Z" fill={BRAND_TILE} stroke="#f2eee7" strokeWidth={1.5} />
              <Path d="M27 30 v-2.8 a5 5 0 0 1 10 0 V30" fill="none" stroke="#f2eee7" strokeWidth={2.4} strokeLinecap="round" />
              <Path d="M10 11.2 Q10.7 13.3 12.8 14 Q10.7 14.7 10 16.8 Q9.3 14.7 7.2 14 Q9.3 13.3 10 11.2 Z" fill="#f2eee7" />
              <Path d="M55 10 Q55.5 11.5 57 12 Q55.5 12.5 55 14 Q54.5 12.5 53 12 Q54.5 11.5 55 10 Z" fill="#c9c7d0" fillOpacity={0.9} />
              <Path d="M7 35.6 Q7.6 37.4 9.4 38 Q7.6 38.6 7 40.4 Q6.4 38.6 4.6 38 Q6.4 37.4 7 35.6 Z" fill="#f2eee7" fillOpacity={0.85} />
              <Path d="M57 40.2 Q57.45 41.55 58.8 42 Q57.45 42.45 57 43.8 Q56.55 42.45 55.2 42 Q56.55 41.55 57 40.2 Z" fill="#a5a3b0" fillOpacity={0.85} />
              <Path d="M12 53.4 Q12.4 54.6 13.6 55 Q12.4 55.4 12 56.6 Q11.6 55.4 10.4 55 Q11.6 54.6 12 53.4 Z" fill="#c9c7d0" fillOpacity={0.8} />
              <Circle cx="52" cy="31" r="0.9" fill="#f2eee7" fillOpacity={0.55} />
              <Circle cx="34" cy="57.5" r="1" fill="#a5a3b0" fillOpacity={0.6} />
            </Svg>
            <View style={{ marginLeft: 6 }}>
              <Text style={styles.brand}>
                Market<Text style={styles.brandVerse}>Verse</Text>
              </Text>
              <Text style={styles.brandSub}>marketverseapp.com</Text>
            </View>
          </View>
          <Text style={styles.invoiceTitle}>{l.invoice.toUpperCase()}</Text>
        </View>

        {/* Invoice meta, right-aligned under the band */}
        <View style={styles.metaWrap}>
          <View style={styles.metaTable}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{l.invoiceNo}</Text>
              <Text style={styles.metaValue}>{data.number}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{l.issued}</Text>
              <Text style={styles.metaValue}>{data.issuedAt}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{l.orderRef}</Text>
              <Text style={styles.metaValue}>#{data.orderShortId}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{l.orderDate}</Text>
              <Text style={styles.metaValue}>{data.orderDate}</Text>
            </View>
          </View>
        </View>

        <View style={styles.rule} />

        {/* Parties */}
        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>{l.billTo}</Text>
            {data.buyer.name ? <Text style={styles.partyName}>{data.buyer.name}</Text> : null}
            <Text style={styles.partyLine}>{data.buyer.email}</Text>
          </View>
          {addr && (addr.line1 || addr.city) ? (
            <View style={styles.party}>
              <Text style={styles.partyLabel}>{l.shipTo}</Text>
              {addr.name ? <Text style={styles.partyName}>{addr.name}</Text> : null}
              {addr.line1 ? <Text style={styles.partyLine}>{addr.line1}</Text> : null}
              {addr.line2 ? <Text style={styles.partyLine}>{addr.line2}</Text> : null}
              <Text style={styles.partyLine}>
                {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ")}
              </Text>
              {addr.country ? <Text style={styles.partyLine}>{addr.country}</Text> : null}
            </View>
          ) : null}
        </View>

        {/* Items */}
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.cItem]}>{l.item}</Text>
            <Text style={[styles.th, styles.cSeller]}>{l.seller}</Text>
            <Text style={[styles.th, styles.cQty]}>{l.qty}</Text>
            <Text style={[styles.th, styles.cPrice]}>{l.unitPrice}</Text>
            <Text style={[styles.th, styles.cTotal]}>{l.lineTotal}</Text>
          </View>

          {data.lines.map((line, i) => (
            <View style={styles.row} key={i} wrap={false}>
              <View style={styles.cItem}>
                {line.image ? (
                  // @react-pdf's Image is not an HTML img and has no alt prop.
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image src={line.image} style={styles.itemThumb} />
                ) : null}
                <View style={styles.itemTextCol}>
                  <Text style={styles.itemTitle}>{line.title}</Text>
                  {line.variantLabel ? <Text style={styles.itemVariant}>{line.variantLabel}</Text> : null}
                </View>
              </View>
              <Text style={[styles.sellerText, styles.cSeller]}>{line.sellerName}</Text>
              <Text style={[styles.num, styles.cQty]}>{line.quantity}</Text>
              <Text style={[styles.num, styles.cPrice]}>{line.unitPrice}</Text>
              <Text style={[styles.numStrong, styles.cTotal]}>{line.lineTotal}</Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={styles.totals}>
          <View style={styles.totalBox}>
            {data.discount || data.shippingCost ? (
              <>
                <View style={styles.subtotalRow}>
                  <Text style={styles.subtotalLabel}>{l.subtotal}</Text>
                  <Text style={styles.subtotalValue}>{data.subtotal}</Text>
                </View>
                {data.discount ? (
                  <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalLabel}>
                      {l.discount}{data.couponCode ? ` (${data.couponCode})` : ""}
                    </Text>
                    <Text style={styles.subtotalValue}>-{data.discount}</Text>
                  </View>
                ) : null}
                {data.shippingCost ? (
                  <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalLabel}>{l.shipping}</Text>
                    <Text style={styles.subtotalValue}>{data.shippingCost}</Text>
                  </View>
                ) : null}
              </>
            ) : null}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{l.total}</Text>
              <Text style={styles.totalValue}>{data.total}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer} fixed>{l.footer}</Text>
      </Page>
    </Document>
  );
}
