import { describe, expect, it } from "vitest";
import { buildCampaignQrValue, buildVietQrPayload, crc16Ccitt } from "./qr";

describe("crc16Ccitt", () => {
  it("matches known CCITT-FALSE vector", () => {
    expect(crc16Ccitt("0352352525")).toBe("29B1");
  });

  it("returns uppercase hex padded to 4 chars", () => {
    const crc = crc16Ccitt("A");
    expect(crc).toMatch(/^[0-9A-F]{4}$/);
  });
});

describe("buildVietQrPayload", () => {
  const baseInput = {
    bankBin: "970424",
    accountNumber: "0352352525",
    merchantName: "Shinhan Merchant",
    merchantCity: "Ho Chi Minh",
  };

  it("builds static QR payload when amount is missing", () => {
    const payload = buildVietQrPayload(baseInput);
    expect(payload).toContain("000201");
    expect(payload).toContain("010211");
    expect(payload).toContain("52040000");
    expect(payload).toContain("5303704");
    expect(payload).toContain("5802VN");
    expect(payload).not.toContain("54");
  });

  it("builds dynamic QR payload with amount tag when amount is provided", () => {
    const payload = buildVietQrPayload({ ...baseInput, amount: "150000" });
    expect(payload).toContain("010212");
    expect(payload).toContain("5406150000");
  });

  it("includes VietQR merchant account info with NAPAS GUID, BIN and account", () => {
    const payload = buildVietQrPayload(baseInput);
    expect(payload).toContain("0010A000000727");
    expect(payload).toContain("0123");
    expect(payload).toContain("0006970424");
    expect(payload).toContain("01090352352525");
    expect(payload).toContain("0208QRIBFTTA");
  });

  it("normalizes description to ASCII in additional data field", () => {
    const payload = buildVietQrPayload({
      ...baseInput,
      description: "Cà phê sữa đá",
    });
    expect(payload).toContain("62");
    expect(payload).toContain("05");
    expect(payload).toContain("Ca phe sua da");
    expect(payload).not.toContain("à");
    expect(payload).not.toContain("ê");
  });

  it("appends valid CRC tag and checksum", () => {
    const payload = buildVietQrPayload({ ...baseInput, amount: 10000 });
    expect(payload.slice(-8, -4)).toBe("6304");
    const bodyWithoutChecksum = payload.slice(0, -4);
    const checksum = payload.slice(-4);
    expect(crc16Ccitt(bodyWithoutChecksum)).toBe(checksum);
  });

  it("supports VPBank BIN and 10-digit account-like value", () => {
    const payload = buildVietQrPayload({
      bankBin: "970432",
      accountNumber: "0968238333",
      merchantName: "Shinhan Merchant",
      merchantCity: "Ho Chi Minh",
      amount: "20000",
      description: "VPBank test",
    });
    expect(payload).toContain("0006970432");
    expect(payload).toContain("01100968238333");
    expect(payload).toContain("010212");
    expect(payload.slice(-8, -4)).toBe("6304");
  });

  it("rejects decimal amount for VND", () => {
    expect(() =>
      buildVietQrPayload({
        ...baseInput,
        amount: "1000.50",
      }),
    ).toThrow("VND amount must be an integer without decimal places.");
  });

  it("treats empty amount as undefined and builds static QR", () => {
    const payload = buildVietQrPayload({
      ...baseInput,
      amount: "",
    });
    expect(payload).toContain("010211");
    expect(payload).not.toContain("54");
  });
});

describe("buildCampaignQrValue payment mode", () => {
  const campaign = {
    title: "Test Campaign",
    targetAudience: "",
    discount: {
      type: "fixed_amount" as const,
      value: 20000,
      minOrderValue: 0,
      maxUsagePerUser: 1,
      totalCodes: 1,
      validityDays: 1,
      applicableCategories: "",
    },
    budget: 1000000,
    pushMessage: "",
    status: "drafting" as const,
    estimation: null,
    aiInsight: null,
  };

  it("includes amount tag when dynamic payment amount is provided", () => {
    const payload = buildCampaignQrValue(campaign, {
      mode: "payment",
      dynamic: true,
      timeSlot: "morning",
      paymentConfig: {
        bankBin: "970424",
        accountNumber: "0352352525",
        amount: "50000",
        merchantName: "Shinhan Merchant",
        merchantCity: "Ho Chi Minh",
      },
    });
    expect(payload).toContain("010212");
    expect(payload).toContain("540550000");
  });
});
