import axios from "axios";
import { env } from "../config/env";
import type { Order } from "../tickets/orderService";

interface MercadoPagoPayment {
  id: string | number;
  status?: string;
  transaction_amount?: number;
  date_created?: string;
  payer?: { identification?: { type?: string; number?: string } };
}

interface PaymentSearchResponse {
  results?: MercadoPagoPayment[];
}

export interface MatchingPayment {
  paymentId: string;
  transactionAmount: number;
  dateCreated: Date;
  payerIdentification: Record<string, string> | null;
  rawPayload: MercadoPagoPayment;
}

export async function findApprovedPaymentForOrder(order: Order): Promise<MatchingPayment | null> {
  if (!env.MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN no está configurado.");
  }

  const windowStart = new Date(
    Date.now() - env.PAYMENT_MATCH_WINDOW_MINUTES * 60 * 1000,
  );
  const beginDate = order.createdAt > windowStart ? order.createdAt : windowStart;

  const response = await axios.get<PaymentSearchResponse>(
    "https://api.mercadopago.com/v1/payments/search",
    {
      headers: { Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}` },
      params: {
        sort: "date_created",
        criteria: "desc",
        range: "date_created",
        begin_date: beginDate.toISOString(),
        end_date: (order.expiresAt && order.expiresAt < new Date()
          ? order.expiresAt
          : new Date()
        ).toISOString(),
        status: "approved",
        limit: 100,
      },
    },
  );

  const payment = response.data.results?.find((candidate) => {
    if (candidate.status !== "approved" || candidate.id === undefined) return false;
    if (candidate.transaction_amount !== order.totalAmount || !candidate.date_created) return false;

    const dateCreated = new Date(candidate.date_created);
    return (
      !Number.isNaN(dateCreated.getTime()) &&
      dateCreated >= beginDate &&
      (!order.expiresAt || dateCreated <= order.expiresAt)
    );
  });

  if (!payment || !payment.date_created || payment.transaction_amount === undefined) return null;

  return {
    paymentId: String(payment.id),
    transactionAmount: payment.transaction_amount,
    dateCreated: new Date(payment.date_created),
    payerIdentification: payment.payer?.identification
      ? { ...payment.payer.identification }
      : null,
    rawPayload: payment,
  };
}
