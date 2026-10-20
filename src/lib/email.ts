import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { SITE_CONFIG } from "./config";
import { prisma } from "./db";
import { formatCurrency } from "./formatters";
import { orderPath } from "./order-access";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM);
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
  }
  return transporter;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Sends one email. In production an unconfigured transport is an error (so the job is
 * retried and visible as FAILED) rather than a silent success. Outside production
 * the message is logged so local flows can be inspected without an SMTP server.
 */
export async function sendEmail(message: OutgoingEmail): Promise<void> {
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("EMAIL_NOT_CONFIGURED: Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and EMAIL_FROM.");
    }
    console.log(`[email:dev] to=${message.to} subject="${message.subject}"`);
    return;
  }

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="font-weight:800;font-size:20px;margin-bottom:16px">${escapeHtml(SITE_CONFIG.brandName)}</div>
<div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0">
<h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(title)}</h1>
${bodyHtml}
</div>
<p style="font-size:12px;color:#64748b;margin-top:16px">Questions? Contact ${escapeHtml(SITE_CONFIG.supportEmail)}.</p>
</div></body></html>`;
}

export async function buildOrderEmail(
  template: "ORDER_CONFIRMATION" | "ORDER_SHIPPED",
  orderId: string,
  extra?: { carrierName?: string; trackingNumber?: string; trackingUrl?: string | null }
): Promise<OutgoingEmail | null> {
  const order = await prisma.customerOrder.findUnique({
    where: { id: orderId },
    include: { sellerOrders: { include: { items: true } } },
  });
  if (!order) return null;

  const link = `${SITE_CONFIG.canonicalUrl}${orderPath(order.id, { guest: !order.customerUserId })}`;
  const isCod = order.notes?.includes("CASH_ON_DELIVERY");
  const items = order.sellerOrders.flatMap((so) => so.items);

  const rowsHtml = items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${escapeHtml(i.productTitleSnapshot)}${
          i.variantNameSnapshot && i.variantNameSnapshot !== "Default" ? ` (${escapeHtml(i.variantNameSnapshot)})` : ""
        } &times; ${i.quantity}</td><td style="padding:6px 0;text-align:right">${escapeHtml(formatCurrency(i.totalMinor))}</td></tr>`
    )
    .join("");
  const rowsText = items.map((i) => `- ${i.productTitleSnapshot} x ${i.quantity}: ${formatCurrency(i.totalMinor)}`).join("\n");

  if (template === "ORDER_CONFIRMATION") {
    const payLine = isCod
      ? `Payment: Cash on delivery. Please keep ${formatCurrency(order.totalMinor)} ready for the courier.`
      : `Payment status: ${order.paymentStatus}.`;
    return {
      to: order.customerEmail,
      subject: `Order ${order.orderNumber} received`,
      text: `Thank you for your order ${order.orderNumber}.\n\n${rowsText}\n\nTotal: ${formatCurrency(order.totalMinor)}\n${payLine}\n\nView your order: ${link}`,
      html: layout(
        `Thank you for your order ${order.orderNumber}`,
        `<table style="width:100%;font-size:14px;border-collapse:collapse">${rowsHtml}
<tr><td style="padding-top:10px;border-top:1px solid #e2e8f0"><strong>Total</strong></td><td style="padding-top:10px;border-top:1px solid #e2e8f0;text-align:right"><strong>${escapeHtml(formatCurrency(order.totalMinor))}</strong></td></tr></table>
<p style="font-size:14px">${escapeHtml(payLine)}</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#047857;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700">View order</a></p>`
      ),
    };
  }

  const carrier = extra?.carrierName || "your carrier";
  const tracking = extra?.trackingNumber || "";
  return {
    to: order.customerEmail,
    subject: `Order ${order.orderNumber} has shipped`,
    text: `Your order ${order.orderNumber} has been handed to ${carrier}.\nTracking number: ${tracking}\n${extra?.trackingUrl ? `Track: ${extra.trackingUrl}\n` : ""}\nView your order: ${link}`,
    html: layout(
      `Order ${order.orderNumber} has shipped`,
      `<p style="font-size:14px">Handed to <strong>${escapeHtml(carrier)}</strong>. Tracking number: <strong>${escapeHtml(tracking)}</strong>.</p>
${extra?.trackingUrl ? `<p><a href="${escapeHtml(extra.trackingUrl)}">Track on the carrier website</a></p>` : ""}
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#047857;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700">View order</a></p>`
    ),
  };
}
