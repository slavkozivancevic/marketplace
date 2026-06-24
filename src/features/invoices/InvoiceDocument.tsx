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
} from "@react-pdf/renderer";

// Liberation Sans covers Latin Extended (Serbian č ć š ž đ, German umlauts,
// Spanish accents) which the built-in Helvetica does not. Served from the app's
// own public/ so the PDF doesn't depend on any package's internals at runtime.
Font.register({
  family: "Liberation",
  fonts: [
    { src: path.join(process.cwd(), "public/fonts/LiberationSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(process.cwd(), "public/fonts/LiberationSans-Bold.ttf"), fontWeight: 700 },
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
  // Subtotal + discount are present only when a coupon was applied.
  subtotal: string | null;
  discount: string | null;
  couponCode: string | null;
  total: string;
  labels: InvoiceLabels;
};

const INK = "#18181b";
const MUTED = "#71717a";
const FAINT = "#a1a1aa";
const HAIR = "#e4e4e7";

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 64,
    paddingHorizontal: 44,
    fontSize: 9.5,
    lineHeight: 1.4,
    color: "#3f3f46",
    fontFamily: "Liberation",
  },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandWrap: { flexDirection: "column" },
  brandMark: { width: 34, height: 34, borderRadius: 8, backgroundColor: INK, marginBottom: 8, justifyContent: "center", alignItems: "center" },
  brand: { fontSize: 13, fontWeight: 700, color: INK },
  brandSub: { fontSize: 8.5, color: FAINT, marginTop: 1 },

  invoiceTitle: { fontSize: 26, fontWeight: 700, color: INK, letterSpacing: 1, textAlign: "right", marginBottom: 16 },
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
  partyLine: { fontSize: 9.5, color: "#52525b", marginBottom: 1 },

  // Table - clean, borderless, hairline-separated rows
  table: { marginTop: 26 },
  thead: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1.5, borderBottomColor: INK },
  th: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 },
  row: { flexDirection: "row", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#f1f1f3" },

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
  num: { fontSize: 9.5, color: "#27272a" },
  numStrong: { fontSize: 9.5, color: INK, fontWeight: 700 },

  // Totals
  totals: { flexDirection: "row", justifyContent: "flex-end", marginTop: 18 },
  totalBox: { width: "42%" },
  subtotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 6 },
  subtotalLabel: { fontSize: 9.5, color: MUTED },
  subtotalValue: { fontSize: 9.5, color: "#27272a" },
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandWrap}>
            <View style={styles.brandMark}>
              <Svg width={18} height={18} viewBox="0 0 24 24">
                <Path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" stroke="#ffffff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" stroke="#ffffff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" stroke="#ffffff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M2 7h20" stroke="#ffffff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" stroke="#ffffff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.brand}>Marketplace</Text>
            <Text style={styles.brandSub}>marketplace.app</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>{l.invoice.toUpperCase()}</Text>
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
            {data.discount ? (
              <>
                <View style={styles.subtotalRow}>
                  <Text style={styles.subtotalLabel}>{l.subtotal}</Text>
                  <Text style={styles.subtotalValue}>{data.subtotal}</Text>
                </View>
                <View style={styles.subtotalRow}>
                  <Text style={styles.subtotalLabel}>
                    {l.discount}{data.couponCode ? ` (${data.couponCode})` : ""}
                  </Text>
                  <Text style={styles.subtotalValue}>-{data.discount}</Text>
                </View>
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
