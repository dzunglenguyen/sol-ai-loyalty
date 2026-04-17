import type { CampaignDraft } from "@/lib/merchant-campaign/types";

/** Shinhan Bank Vietnam Ltd — mã BIN NAPAS / VietQR (theo liên minh NAPAS; có thể cấu hình `NEXT_PUBLIC_QR_BANK_BIN`). */
export const SHINHAN_VIETQR_BANK_BIN = "970424";

export interface VietQrPayloadInput {
  bankBin: string;
  accountNumber: string;
  amount?: number | string;
  description?: string;
  merchantName: string;
  merchantCity: string;
}

type QrMode = "payment" | "tracking";

interface BuildCampaignQrOptions {
  dynamic: boolean;
  timeSlot: "morning" | "afternoon";
  campaignId?: string | null;
  origin?: string;
  mode?: QrMode;
  paymentConfig?: {
    bankBin?: string;
    accountNumber?: string;
    merchantName?: string;
    merchantCity?: string;
    amount?: number | string;
    description?: string;
  };
}

export interface EmvTlvNode {
  tag: string;
  length: number;
  value: string;
}

export interface VietQrDebugSummary {
  tlv: EmvTlvNode[];
  merchantAccountInfo: EmvTlvNode[];
  additionalData: EmvTlvNode[];
  crc: {
    provided: string | null;
    computed: string | null;
    valid: boolean;
  };
}

function encodeTlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${tag}${len}${value}`;
}

function normalizeDigitsOnly(value: string | number, fieldName: string): string {
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${fieldName} must contain digits only.`);
  }
  return normalized;
}

function normalizeAsciiNoDiacritics(value: string): string {
  return value
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

function normalizeVndAmount(amount: number | string): string {
  const raw = typeof amount === "number" ? amount.toString() : amount.trim();
  if (!/^\d+$/.test(raw)) {
    throw new Error("VND amount must be an integer without decimal places.");
  }
  return raw;
}

function normalizeOptionalAmount(amount?: number | string): string | undefined {
  if (amount === undefined) return undefined;
  if (typeof amount === "string" && amount.trim() === "") return undefined;
  return normalizeVndAmount(amount);
}

export function crc16Ccitt(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildVietQrPayload(input: VietQrPayloadInput): string {
  const bankBin = normalizeDigitsOnly(input.bankBin, "bankBin");
  const accountNumber = normalizeDigitsOnly(input.accountNumber, "accountNumber");
  const merchantName = normalizeAsciiNoDiacritics(input.merchantName).slice(0, 25) || "SHINHAN MERCHANT";
  const merchantCity = normalizeAsciiNoDiacritics(input.merchantCity).slice(0, 15) || "HCM";
  const description = input.description ? normalizeAsciiNoDiacritics(input.description).slice(0, 99) : "";
  const amount = normalizeOptionalAmount(input.amount);

  const beneficiaryOrg = encodeTlv("00", bankBin) + encodeTlv("01", accountNumber);
  const merchantAccountInfo =
    encodeTlv("00", "A000000727") + encodeTlv("01", beneficiaryOrg) + encodeTlv("02", "QRIBFTTA");

  const fields: string[] = [
    encodeTlv("00", "01"),
    encodeTlv("01", amount ? "12" : "11"),
    encodeTlv("38", merchantAccountInfo),
    encodeTlv("52", "0000"),
    encodeTlv("53", "704"),
    encodeTlv("58", "VN"),
    encodeTlv("59", merchantName),
    encodeTlv("60", merchantCity),
  ];

  if (amount) {
    fields.push(encodeTlv("54", amount));
  }

  if (description) {
    const additionalData = encodeTlv("05", description);
    fields.push(encodeTlv("62", additionalData));
  }

  const payloadWithoutCrc = `${fields.join("")}6304`;
  const crc = crc16Ccitt(payloadWithoutCrc);
  return `${payloadWithoutCrc}${crc}`;
}

function parseTlv(payload: string): EmvTlvNode[] {
  const nodes: EmvTlvNode[] = [];
  let cursor = 0;
  while (cursor + 4 <= payload.length) {
    const tag = payload.slice(cursor, cursor + 2);
    const lenRaw = payload.slice(cursor + 2, cursor + 4);
    const length = Number(lenRaw);
    if (!Number.isFinite(length)) {
      break;
    }
    const valueStart = cursor + 4;
    const valueEnd = valueStart + length;
    if (valueEnd > payload.length) {
      break;
    }
    nodes.push({ tag, length, value: payload.slice(valueStart, valueEnd) });
    cursor = valueEnd;
  }
  return nodes;
}

export function decodeVietQrPayload(payload: string): VietQrDebugSummary {
  const tlv = parseTlv(payload);
  const merchantAccountTag = tlv.find((node) => node.tag === "38");
  const additionalDataTag = tlv.find((node) => node.tag === "62");
  const crcTag = tlv.find((node) => node.tag === "63");

  let provided: string | null = null;
  let computed: string | null = null;
  let valid = false;

  if (crcTag) {
    provided = crcTag.value;
    const crcRaw = `63${crcTag.length.toString().padStart(2, "0")}${crcTag.value}`;
    const index = payload.lastIndexOf(crcRaw);
    if (index >= 0) {
      const payloadWithoutChecksum = payload.slice(0, index) + "6304";
      computed = crc16Ccitt(payloadWithoutChecksum);
      valid = computed === provided;
    }
  }

  return {
    tlv,
    merchantAccountInfo: merchantAccountTag ? parseTlv(merchantAccountTag.value) : [],
    additionalData: additionalDataTag ? parseTlv(additionalDataTag.value) : [],
    crc: {
      provided,
      computed,
      valid,
    },
  };
}

function buildTrackingQrValue(campaign: CampaignDraft, options: BuildCampaignQrOptions): string {
  const slug = encodeURIComponent(campaign.title.toLowerCase().replace(/\s+/g, "-") || "demo");
  const basePath = options.origin ? `${options.origin}/campaign/${slug}` : `/campaign/${slug}`;
  const params = new URLSearchParams({
    ref: "qr",
    dynamic: options.dynamic ? "1" : "0",
    slot: options.timeSlot,
    offer: options.timeSlot === "morning" ? "cafe" : "milk-tea",
  });
  const destinationUrl = `${basePath}?${params.toString()}`;

  if (options.campaignId && options.origin) {
    const trackingParams = new URLSearchParams({
      campaignId: options.campaignId,
      slot: options.timeSlot,
      dynamic: options.dynamic ? "1" : "0",
      offer: options.timeSlot === "morning" ? "cafe" : "milk-tea",
    });
    return `${options.origin}/api/qr/scan?${trackingParams.toString()}`;
  }

  return destinationUrl;
}

export function buildCampaignQrValue(
  campaign: CampaignDraft,
  options: BuildCampaignQrOptions,
): string {
  if (options.mode === "tracking") {
    return buildTrackingQrValue(campaign, options);
  }

  const configuredAmount =
    options.paymentConfig?.amount !== undefined
      ? normalizeOptionalAmount(options.paymentConfig.amount)
      : options.dynamic && campaign.discount.minOrderValue > 0
        ? campaign.discount.minOrderValue
        : undefined;

  return buildVietQrPayload({
    bankBin:
      options.paymentConfig?.bankBin ||
      process.env.NEXT_PUBLIC_QR_BANK_BIN ||
      SHINHAN_VIETQR_BANK_BIN,
    accountNumber:
      options.paymentConfig?.accountNumber ||
      process.env.NEXT_PUBLIC_QR_ACCOUNT_NUMBER ||
      "0352352525",
    amount: configuredAmount,
    description: options.paymentConfig?.description || `KM-${options.timeSlot}`,
    merchantName: options.paymentConfig?.merchantName || campaign.title || "SHINHAN MERCHANT",
    merchantCity:
      options.paymentConfig?.merchantCity || process.env.NEXT_PUBLIC_QR_MERCHANT_CITY || "HO CHI MINH",
  });
}
