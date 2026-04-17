export interface EMVCoData {
  payloadFormatIndicator?: string;
  pointOfInitiationMethod?: string;
  merchantAccount38?: {
    guid?: string;
    beneficiary?: {
      bin?: string;
      account?: string;
    };
    serviceCode?: string;
  };
  merchantCategoryCode?: string;
  transactionCurrency?: string;
  transactionAmount?: string;
  countryCode?: string;
  merchantName?: string;
  merchantCity?: string;
  additionalData62?: {
    billNumber?: string;
    mobileNumber?: string;
    storeLabel?: string;
    loyaltyNumber?: string;
    referenceLabel?: string;
    customerLabel?: string;
    terminalLabel?: string;
    purpose?: string;
    additionalConsumerData?: string;
  };
  crc?: string;
  raw?: string;
}

export const BANK_MAP: Record<string, string> = {
  "970405": "Agribank",
  "970415": "VietinBank",
  "970436": "Vietcombank",
  "970418": "BIDV",
  "970403": "Sacombank",
  "970422": "MBBank",
  "970423": "TPBank",
  "970416": "ACB",
  "970432": "VPBank",
  "970407": "Techcombank",
  "970419": "HDBank",
  "970425": "ABBANK",
  "970437": "HanoiBank",
  "970441": "VIB",
  "970427": "VietCapitalBank",
  "970438": "BaoVietBank",
  "970428": "NamABank",
  "970431": "Eximbank",
  "970443": "SHB",
  "970429": "SCB",
  "970412": "PVcomBank",
  "970448": "BacABank",
  "970433": "VietABank",
  "970409": "NASB",
  "970424": "Shinhan Bank",
  "970421": "VRB",
  "970414": "OceanBank",
  "970439": "PublicBank",
  "970430": "PGBank",
  "970408": "GPBank",
  "970440": "SeABank",
  "970452": "KienLongBank",
  "970426": "MSB",
  "970442": "DongABank",
  "970449": "LienVietPostBank",
};

export function parseEMVCo(qrString: string): EMVCoData {
  const data: EMVCoData = { raw: qrString };
  let index = 0;

  function extractTLV(s: string) {
    const tlv: Record<string, string> = {};
    let i = 0;
    while (i < s.length) {
      const tag = s.substring(i, i + 2);
      const lenStr = s.substring(i + 2, i + 4);
      const len = parseInt(lenStr, 10);
      if (isNaN(len)) break;
      const val = s.substring(i + 4, i + 4 + len);
      tlv[tag] = val;
      i += 4 + len;
    }
    return tlv;
  }

  const root = extractTLV(qrString);

  if (root["00"]) data.payloadFormatIndicator = root["00"];
  if (root["01"]) data.pointOfInitiationMethod = root["01"];
  
  if (root["38"]) {
    const sub38 = extractTLV(root["38"]);
    data.merchantAccount38 = {
      guid: sub38["00"],
      serviceCode: sub38["02"]
    };
    if (sub38["01"]) {
      const sub01 = extractTLV(sub38["01"]);
      data.merchantAccount38.beneficiary = {
        bin: sub01["00"],
        account: sub01["01"]
      };
    }
  }

  if (root["52"]) data.merchantCategoryCode = root["52"];
  if (root["53"]) data.transactionCurrency = root["53"];
  if (root["54"]) data.transactionAmount = root["54"];
  if (root["58"]) data.countryCode = root["58"];
  if (root["59"]) data.merchantName = root["59"];
  if (root["60"]) data.merchantCity = root["60"];

  if (root["62"]) {
    const sub62 = extractTLV(root["62"]);
    data.additionalData62 = {
      billNumber: sub62["01"],
      mobileNumber: sub62["02"],
      storeLabel: sub62["03"],
      loyaltyNumber: sub62["04"],
      referenceLabel: sub62["05"],
      customerLabel: sub62["06"],
      terminalLabel: sub62["07"],
      purpose: sub62["08"] || sub62["01"] || sub62["05"], // Fallback to bill number or reference
      additionalConsumerData: sub62["09"]
    };
  }

  if (root["63"]) data.crc = root["63"];

  return data;
}
