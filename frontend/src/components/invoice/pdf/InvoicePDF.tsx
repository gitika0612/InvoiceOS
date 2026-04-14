import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Path,
} from "@react-pdf/renderer";
import { ParsedInvoice } from "../InvoicePreviewCard";

const styles = StyleSheet.create({
  page: {
    fontSize: 10,
    color: "#111827",
    backgroundColor: "#ffffff",
    padding: 48,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 40,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandDot: {
    width: 28,
    height: 28,
    backgroundColor: "#4F46E5",
    borderRadius: 6,
    marginRight: 8,
  },
  brandName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  invoiceLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#4F46E5",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginBottom: 32,
  },
  fromToRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  fromToBox: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#9CA3AF",
    marginBottom: 8,
  },
  sectionValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: 10,
    color: "#6B7280",
  },
  table: {
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderRadius: 6,
    padding: 10,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    padding: 10,
    borderBottom: "1 solid #F3F4F6",
  },
  tableColDesc: { flex: 3 },
  tableColQty: { flex: 1, textAlign: "center" },
  tableColRate: { flex: 1.5, textAlign: "right" },
  tableColAmount: { flex: 1.5, textAlign: "right" },
  tableHeaderText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#9CA3AF",
  },
  tableBodyText: {
    fontSize: 10,
    color: "#374151",
  },
  tableBodyBold: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  totalsBox: {
    marginLeft: "auto",
    width: 240,
    marginBottom: 40,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  totalLabel: {
    fontSize: 10,
    color: "#6B7280",
  },
  totalValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
  },
  totalDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 6,
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#4F46E5",
  },
  grandTotalValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#4F46E5",
  },
  paymentTermsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  paymentTermsLabel: {
    fontSize: 10,
    color: "#6B7280",
  },
  paymentTermsValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
  },
  footer: {
    borderTop: "1 solid #E5E7EB",
    paddingTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 9,
    color: "#9CA3AF",
  },
  statusBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  statusText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#92400E",
  },
});

interface InvoicePDFProps {
  invoice: ParsedInvoice;
  invoiceNumber: string;
  userName?: string;
}

function formatINR(amount: number) {
  return `Rs. ${amount.toLocaleString("en-IN")}`;
}

function getInvoiceDates(paymentTermsDays?: number) {
  const now = new Date();
  const days = paymentTermsDays || 15;
  const due = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const today = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const dueDate = due.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return { today, dueDate };
}

export function InvoicePDF({
  invoice,
  invoiceNumber,
  userName = "InvoiceOS User",
}: InvoicePDFProps) {
  const { today, dueDate } = getInvoiceDates(invoice.paymentTermsDays);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandDot}>
              <View style={{ marginTop: 6, marginLeft: 6 }}>
                <Svg width="16" height="16" viewBox="0 0 24 24">
                  <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" />
                </Svg>
              </View>
            </View>
            <Text style={styles.brandName}>InvoiceOS</Text>
          </View>
          <View>
            <Text style={styles.invoiceLabel}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
          </View>
        </View>

        {/* ── Divider ── */}
        <View style={styles.divider} />

        {/* ── From / To / Date ── */}
        <View style={styles.fromToRow}>
          <View style={styles.fromToBox}>
            <Text style={styles.sectionLabel}>FROM</Text>
            <Text style={styles.sectionValue}>{userName}</Text>
            <Text style={styles.sectionSub}>via InvoiceOS</Text>
          </View>
          <View style={styles.fromToBox}>
            <Text style={styles.sectionLabel}>BILL TO</Text>
            <Text style={styles.sectionValue}>{invoice.clientName}</Text>
          </View>
          <View style={styles.fromToBox}>
            <Text style={styles.sectionLabel}>INVOICE DATE</Text>
            <Text style={styles.sectionValue}>{today}</Text>
            <Text style={styles.sectionSub}>Due: {dueDate}</Text>
          </View>
        </View>

        {/* ── Table ── */}
        <View style={styles.table}>
          {/* Table header */}
          <View style={styles.tableHeader}>
            <View style={styles.tableColDesc}>
              <Text style={styles.tableHeaderText}>DESCRIPTION</Text>
            </View>
            <View style={styles.tableColQty}>
              <Text style={styles.tableHeaderText}>QTY</Text>
            </View>
            <View style={styles.tableColRate}>
              <Text style={styles.tableHeaderText}>RATE</Text>
            </View>
            <View style={styles.tableColAmount}>
              <Text style={styles.tableHeaderText}>AMOUNT</Text>
            </View>
          </View>

          {/* Line items — supports multiple */}
          {invoice.lineItems && invoice.lineItems.length > 0 ? (
            invoice.lineItems.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <View style={styles.tableColDesc}>
                  <Text style={styles.tableBodyBold}>{item.description}</Text>
                  <Text
                    style={[
                      styles.tableBodyText,
                      { color: "#9CA3AF", marginTop: 2 },
                    ]}
                  >
                    {item.quantity} {item.unit}
                  </Text>
                </View>
                <View style={styles.tableColQty}>
                  <Text style={[styles.tableBodyText, { textAlign: "center" }]}>
                    {item.quantity} {item.unit}
                  </Text>
                </View>
                <View style={styles.tableColRate}>
                  <Text style={[styles.tableBodyText, { textAlign: "right" }]}>
                    {formatINR(item.rate)}
                  </Text>
                </View>
                <View style={styles.tableColAmount}>
                  <Text style={[styles.tableBodyBold, { textAlign: "right" }]}>
                    {formatINR(item.amount)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            // Fallback for old invoices without lineItems
            <View style={styles.tableRow}>
              <View style={styles.tableColDesc}>
                <Text style={styles.tableBodyBold}>
                  {invoice.workDescription || "Professional Services"}
                </Text>
              </View>
              <View style={styles.tableColQty}>
                <Text style={[styles.tableBodyText, { textAlign: "center" }]}>
                  {invoice.quantity} {invoice.quantityUnit}
                </Text>
              </View>
              <View style={styles.tableColRate}>
                <Text style={[styles.tableBodyText, { textAlign: "right" }]}>
                  {formatINR(invoice.ratePerUnit || 0)}
                </Text>
              </View>
              <View style={styles.tableColAmount}>
                <Text style={[styles.tableBodyBold, { textAlign: "right" }]}>
                  {formatINR(invoice.subtotal)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Totals ── */}
        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatINR(invoice.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>GST ({invoice.gstPercent}%)</Text>
            <Text style={styles.totalValue}>
              {formatINR(invoice.gstAmount)}
            </Text>
          </View>

          {/* Payment terms */}
          {invoice.paymentTermsDays && (
            <View style={styles.paymentTermsRow}>
              <Text style={styles.paymentTermsLabel}>Payment Terms</Text>
              <Text style={styles.paymentTermsValue}>
                {invoice.paymentTermsDays} days
              </Text>
            </View>
          )}

          <View style={styles.totalDivider} />

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total Due</Text>
            <Text style={styles.grandTotalValue}>
              {formatINR(invoice.total)}
            </Text>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Generated by InvoiceOS · {today}
          </Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>PAYMENT PENDING</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
