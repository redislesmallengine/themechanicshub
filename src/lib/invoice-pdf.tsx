import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { getImage } from "@/lib/storage";

// Pure-JS PDF generation (no headless Chrome — that would be a heavy
// addition to a modest VPS already running Postgres/Redis/Garage/
// GlitchTip/the app itself). Used by both the authenticated download route
// (/api/invoices/[id]/pdf) and the public one (/api/invoice/[token]/pdf),
// and attached automatically when an invoice is sent (src/app/(app)/
// invoices/actions.ts).

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#0F172A" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  logo: { width: 56, height: 56, objectFit: "contain", marginBottom: 6 },
  shopName: { fontSize: 14, fontWeight: 700 },
  muted: { color: "#64748B", fontSize: 9 },
  invoiceTitle: { fontSize: 20, fontWeight: 700, textAlign: "right", color: "#0F52BA" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 8, fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5 },
  table: { borderTop: "1px solid #E2E8F0", borderBottom: "1px solid #E2E8F0" },
  tableHeadRow: { flexDirection: "row", backgroundColor: "#0F294A", paddingVertical: 6, paddingHorizontal: 6 },
  tableHeadCell: { color: "#fff", fontSize: 8, fontWeight: 700, textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottom: "1px solid #F1F5F9" },
  cellDesc: { flex: 3 },
  cellQty: { flex: 1, textAlign: "right" },
  cellPrice: { flex: 1, textAlign: "right" },
  cellTotal: { flex: 1, textAlign: "right" },
  totals: { alignSelf: "flex-end", width: 220, marginTop: 12 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { color: "#64748B" },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 6, marginTop: 4, borderTop: "1px solid #0F172A" },
  grandTotalLabel: { fontSize: 12, fontWeight: 700 },
  grandTotalValue: { fontSize: 12, fontWeight: 700 },
  statusBanner: { marginTop: 24, padding: 10, borderRadius: 4 },
  statusBannerText: { fontSize: 10, fontWeight: 700 },
  notes: { marginTop: 20, fontSize: 9, color: "#475569" },
});

export interface InvoicePdfData {
  invoiceNumber: string;
  status: string;
  issueDate: Date;
  dueDate: Date;
  notes: string | null;
  shop: { name: string; address: string | null; phone: string | null; logoDataUri: string | null };
  customer: { name: string; phone: string | null; email: string | null; address: string | null };
  taxLabel: string;
  taxRate: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  paidAt: Date | null;
  paymentMethod: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
  lineItems: { description: string; quantity: string; unitPrice: string; lineTotal: string }[];
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  return (
    <Document title={`Invoice ${data.invoiceNumber}`}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- this is @react-pdf/renderer's Image (PDF drawing primitive), not an HTML img; it has no alt prop */}
            {data.shop.logoDataUri && <Image src={data.shop.logoDataUri} style={styles.logo} />}
            <Text style={styles.shopName}>{data.shop.name}</Text>
            {data.shop.address && <Text style={styles.muted}>{data.shop.address}</Text>}
            {data.shop.phone && <Text style={styles.muted}>{data.shop.phone}</Text>}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={[styles.muted, { textAlign: "right", marginTop: 4 }]}>{data.invoiceNumber}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.muted}>Issued</Text>
              <Text style={{ marginLeft: 8 }}>{fmtDate(data.issueDate)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.muted}>Due</Text>
              <Text style={{ marginLeft: 8 }}>{fmtDate(data.dueDate)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Bill To</Text>
          <Text style={{ fontWeight: 700 }}>{data.customer.name}</Text>
          {data.customer.address && <Text style={styles.muted}>{data.customer.address}</Text>}
          {data.customer.phone && <Text style={styles.muted}>{data.customer.phone}</Text>}
          {data.customer.email && <Text style={styles.muted}>{data.customer.email}</Text>}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeadRow}>
            <Text style={[styles.tableHeadCell, styles.cellDesc]}>Description</Text>
            <Text style={[styles.tableHeadCell, styles.cellQty]}>Qty</Text>
            <Text style={[styles.tableHeadCell, styles.cellPrice]}>Price</Text>
            <Text style={[styles.tableHeadCell, styles.cellTotal]}>Total</Text>
          </View>
          {data.lineItems.map((line, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.cellDesc}>{line.description}</Text>
              <Text style={styles.cellQty}>{line.quantity}</Text>
              <Text style={styles.cellPrice}>${line.unitPrice}</Text>
              <Text style={styles.cellTotal}>${line.lineTotal}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text>${data.subtotal}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {data.taxLabel} ({data.taxRate}%)
            </Text>
            <Text>${data.taxAmount}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>${data.total}</Text>
          </View>
        </View>

        {data.status === "paid" && (
          <View style={[styles.statusBanner, { backgroundColor: "#F0FDF4" }]}>
            <Text style={[styles.statusBannerText, { color: "#166534" }]}>
              PAID {data.paidAt ? `on ${fmtDate(data.paidAt)}` : ""} {data.paymentMethod ? `via ${data.paymentMethod}` : ""}
            </Text>
          </View>
        )}
        {data.status === "void" && (
          <View style={[styles.statusBanner, { backgroundColor: "#FEF2F2" }]}>
            <Text style={[styles.statusBannerText, { color: "#991B1B" }]}>VOID{data.voidReason ? ` — ${data.voidReason}` : ""}</Text>
          </View>
        )}
        {(data.status === "sent" || data.status === "viewed") && (
          <View style={[styles.statusBanner, { backgroundColor: "#FFFBEB" }]}>
            <Text style={[styles.statusBannerText, { color: "#92400E" }]}>Amount Due: ${data.total} by {fmtDate(data.dueDate)}</Text>
          </View>
        )}

        {data.notes && (
          <View style={styles.notes}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text>{data.notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

/** Fetches the shop's logo from Garage/S3 and inlines it as a data URI — the PDF is generated server-side, so it reads storage directly rather than round-tripping through /api/shop-logo. */
async function logoDataUri(logoKey: string | null | undefined): Promise<string | null> {
  if (!logoKey) return null;
  const logo = await getImage(logoKey);
  if (!logo) return null;
  const chunks: Uint8Array[] = [];
  const reader = logo.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const buffer = Buffer.concat(chunks);
  return `data:${logo.contentType};base64,${buffer.toString("base64")}`;
}

export async function renderInvoicePdf(data: Omit<InvoicePdfData, "shop"> & { shop: Omit<InvoicePdfData["shop"], "logoDataUri"> & { logoKey: string | null } }): Promise<Buffer> {
  const logo = await logoDataUri(data.shop.logoKey);
  const fullData: InvoicePdfData = { ...data, shop: { name: data.shop.name, address: data.shop.address, phone: data.shop.phone, logoDataUri: logo } };
  return renderToBuffer(<InvoiceDocument data={fullData} />);
}

// Shared shape for the invoice/lineItems/customer/organization+shopProfile
// query both PDF routes and the "Send Invoice" action load — keeps the
// mapping into renderInvoicePdf's params in one place.
export interface InvoiceWithRelationsForPdf {
  invoiceNumber: string;
  status: string;
  issueDate: Date;
  dueDate: Date;
  notes: string | null;
  subtotal: unknown;
  taxAmount: unknown;
  total: unknown;
  paidAt: Date | null;
  paymentMethod: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
  customer: { name: string; phone: string | null; email: string | null; address: string | null };
  organization: { name: string; shopProfile: { address: string | null; phone: string | null; logoKey: string | null; taxLabel: string | null; taxRate: unknown } | null };
  lineItems: { description: string; quantity: unknown; unitPrice: unknown; lineTotal: unknown }[];
}

export async function renderInvoicePdfFromRecord(invoice: InvoiceWithRelationsForPdf): Promise<Buffer> {
  const shopProfile = invoice.organization.shopProfile;
  return renderInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    notes: invoice.notes,
    shop: { name: invoice.organization.name, address: shopProfile?.address ?? null, phone: shopProfile?.phone ?? null, logoKey: shopProfile?.logoKey ?? null },
    customer: invoice.customer,
    taxLabel: shopProfile?.taxLabel ?? "Tax",
    taxRate: shopProfile?.taxRate?.toString() ?? "0",
    subtotal: String(invoice.subtotal),
    taxAmount: String(invoice.taxAmount),
    total: String(invoice.total),
    paidAt: invoice.paidAt,
    paymentMethod: invoice.paymentMethod,
    voidedAt: invoice.voidedAt,
    voidReason: invoice.voidReason,
    lineItems: invoice.lineItems.map((l) => ({ description: l.description, quantity: String(l.quantity), unitPrice: String(l.unitPrice), lineTotal: String(l.lineTotal) })),
  });
}
