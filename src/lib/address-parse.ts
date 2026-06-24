export interface ParsedShippingAddress {
  name: string;
  phone: string;
  province: string;
  city: string;
  county: string;
  address: string;
}

export interface ParseShippingResult {
  data: ParsedShippingAddress;
  errors: string[];
  warnings: string[];
}

const PHONE_RE = /1[3-9]\d{9}/;
const PHONE_EXTRACT_RE = /(?:\+?86[-\s]?)?(1[3-9]\d{9})/g;

const MUNICIPALITIES = ["北京市", "上海市", "天津市", "重庆市"];

const PROVINCE_PREFIXES = [
  "内蒙古自治区",
  "广西壮族自治区",
  "宁夏回族自治区",
  "新疆维吾尔自治区",
  "西藏自治区",
  "香港特别行政区",
  "澳门特别行政区",
  ...MUNICIPALITIES,
  "河北省",
  "山西省",
  "辽宁省",
  "吉林省",
  "黑龙江省",
  "江苏省",
  "浙江省",
  "安徽省",
  "福建省",
  "江西省",
  "山东省",
  "河南省",
  "湖北省",
  "湖南省",
  "广东省",
  "海南省",
  "四川省",
  "贵州省",
  "云南省",
  "陕西省",
  "甘肃省",
  "青海省",
  "台湾省",
];

function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("86")) {
    return digits.slice(2);
  }
  if (digits.length === 11 && PHONE_RE.test(digits)) {
    return digits;
  }
  const match = raw.match(PHONE_RE);
  return match?.[0] ?? "";
}

function cleanText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/收货人[:：]?/g, "收件人:")
    .replace(/联系人[:：]?/g, "收件人:")
    .replace(/姓名[:：]?/g, "收件人:")
    .replace(/电话[:：]?|手机[:：]?|联系电话[:：]?|手机号码[:：]?/g, "电话:")
    .replace(/详细地址[:：]?|收货地址[:：]?/g, "地址:")
    .replace(/所在地区[:：]?|省市区[:：]?/g, "地区:")
    .trim();
}

function extractLabeled(text: string) {
  const name =
    text.match(/收件人\s*[:：]?\s*([^\n,，;；|]+)/)?.[1]?.trim() ?? "";
  const phoneRaw =
    text.match(/电话\s*[:：]?\s*([\d\s\-+()（）]+)/)?.[1]?.trim() ?? "";
  const region =
    text.match(/地区\s*[:：]?\s*([^\n]+)/)?.[1]?.trim() ?? "";
  const address =
    text.match(/地址\s*[:：]?\s*([^\n]+)/)?.[1]?.trim() ?? "";
  return { name, phone: normalizePhone(phoneRaw), region, address };
}

function parseRegion(addressPart: string) {
  let rest = addressPart.trim();
  let province = "";
  let city = "";
  let county = "";

  for (const m of MUNICIPALITIES) {
    if (rest.startsWith(m)) {
      province = m;
      city = m;
      rest = rest.slice(m.length);
      const district = rest.match(/^(.+?(?:区|县))/);
      if (district) {
        county = district[1];
        rest = rest.slice(county.length);
      }
      return { province, city, county, address: rest.trim() };
    }
  }

  for (const p of PROVINCE_PREFIXES) {
    if (rest.startsWith(p)) {
      province = p;
      rest = rest.slice(p.length);
      break;
    }
  }

  if (!province) {
    const provinceMatch = rest.match(/^(.+?(?:省|自治区|特别行政区))/);
    if (provinceMatch) {
      province = provinceMatch[1];
      rest = rest.slice(province.length);
    }
  }

  const cityMatch = rest.match(/^(.+?(?:市|州|地区|盟))/);
  if (cityMatch) {
    city = cityMatch[1];
    rest = rest.slice(city.length);
  }

  const countyMatch = rest.match(/^(.+?(?:区|县|旗|市|镇|乡|街道))/);
  if (countyMatch) {
    county = countyMatch[1];
    rest = rest.slice(county.length);
  }

  return { province, city, county, address: rest.trim() };
}

function parseMultiline(text: string): ParsedShippingAddress | null {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  let name = "";
  let phone = "";
  let addressPart = "";

  for (const line of lines) {
    const linePhone = normalizePhone(line);
    if (!phone && linePhone && line.replace(/\D/g, "").length >= 11) {
      phone = linePhone;
      const nameCandidate = line.replace(PHONE_EXTRACT_RE, "").trim();
      if (nameCandidate && nameCandidate.length <= 12) {
        name = name.replace(/[^\u4e00-\u9fa5a-zA-Z·]/g, "").slice(0, 20) || name;
        const cleaned = nameCandidate.replace(/[^\u4e00-\u9fa5a-zA-Z·]/g, "");
        if (cleaned) name = cleaned.slice(0, 20);
      }
      continue;
    }
    if (!name && line.length <= 12 && !PHONE_RE.test(line) && /[\u4e00-\u9fa5]/.test(line)) {
      name = line.replace(/[^\u4e00-\u9fa5a-zA-Z·]/g, "").slice(0, 20);
      continue;
    }
    if (!addressPart && (line.length > 6 || /省|市|区|县|路|街|号|镇|乡/.test(line))) {
      addressPart = line;
    }
  }

  if (!phone && !addressPart) return null;
  const region = parseRegion(addressPart);
  return {
    name,
    phone,
    province: region.province,
    city: region.city,
    county: region.county,
    address: region.address || addressPart,
  };
}

function parseInline(text: string): ParsedShippingAddress {
  const phoneMatches = [...text.matchAll(PHONE_EXTRACT_RE)];
  const phone = phoneMatches[0] ? normalizePhone(phoneMatches[0][0]) : "";

  let name = "";
  let addressPart = text;

  if (phoneMatches[0]?.index !== undefined) {
    const before = text.slice(0, phoneMatches[0].index).trim();
    const after = text.slice(phoneMatches[0].index + phoneMatches[0][0].length).trim();
    name = before.replace(/[^\u4e00-\u9fa5a-zA-Z·]/g, "").slice(0, 20);
    addressPart = after || before;
  }

  addressPart = addressPart.replace(/^[，,;；|\s]+/, "").trim();
  const region = parseRegion(addressPart);

  if (!name && addressPart) {
    const tokens = addressPart.split(/[\s,，;；|]+/).filter(Boolean);
    const maybeName = tokens[0];
    if (
      maybeName &&
      maybeName.length <= 8 &&
      !PHONE_RE.test(maybeName) &&
      /[\u4e00-\u9fa5]/.test(maybeName) &&
      !/省|市|区|县|路|街|号/.test(maybeName)
    ) {
      name = maybeName.replace(/[^\u4e00-\u9fa5a-zA-Z·]/g, "");
      const rest = addressPart.slice(maybeName.length).trim();
      const region2 = parseRegion(rest);
      return {
        name,
        phone,
        province: region2.province,
        city: region2.city,
        county: region2.county,
        address: region2.address || rest,
      };
    }
  }

  return {
    name,
    phone,
    province: region.province,
    city: region.city,
    county: region.county,
    address: region.address || addressPart,
  };
}

function validateParsed(data: ParsedShippingAddress, raw: string): ParseShippingResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw.trim()) {
    errors.push("请先粘贴收货信息");
    return { data, errors, warnings };
  }

  const digitCount = raw.replace(/\D/g, "").length;
  if (digitCount > 0 && digitCount < 11) {
    errors.push("手机号位数不足，应为 11 位中国大陆手机号");
  } else if (!data.phone) {
    if (!/\d{7,}/.test(raw)) {
      errors.push("未识别到手机号，请确认包含 11 位手机号");
    } else {
      errors.push("手机号格式不正确，应以 1 开头且为 11 位");
    }
  } else if (!PHONE_RE.test(data.phone)) {
    errors.push("手机号格式不正确，应以 1 开头且为 11 位");
  }

  const phoneMatches = [...raw.matchAll(PHONE_EXTRACT_RE)];
  if (phoneMatches.length > 1) {
    warnings.push(`识别到 ${phoneMatches.length} 个手机号，已使用第一个：${data.phone}`);
  }

  if (!data.name) {
    errors.push("未识别到收货人姓名，请检查姓名是否在手机号前或单独一行");
  } else if (/\d/.test(data.name)) {
    warnings.push("收货人姓名包含数字，请核对是否正确");
  } else if (data.name.length < 2) {
    warnings.push("收货人姓名较短，请核对是否正确");
  }

  const hasRegion = !!(data.province || data.city || data.county);
  const detail = data.address.trim();

  if (!hasRegion && detail.length < 4) {
    errors.push("未识别到省市区信息，请确认地址包含省、市、区（县）");
  } else if (!data.province && (data.city || data.county)) {
    warnings.push("未识别到省份，请手动补充");
  } else if (!data.county && hasRegion) {
    warnings.push("未识别到区/县，请核对或手动补充");
  }

  if (!detail || detail.length < 2) {
    errors.push("未识别到详细地址（街道、门牌号等），请补充完整");
  } else if (detail.length < 4 && !/号|路|街|巷|弄|村|栋|室|楼|组/.test(detail)) {
    warnings.push("详细地址较短，请确认门牌号、街道等信息是否完整");
  }

  return { data, errors, warnings };
}

/** 解析粘贴的收货信息文本，并返回错误/警告提示 */
export function parseShippingAddressText(raw: string): ParseShippingResult {
  const text = cleanText(raw);
  const labeled = extractLabeled(text);

  let data: ParsedShippingAddress;

  if (labeled.name || labeled.phone || labeled.address || labeled.region) {
    const regionSource = [labeled.region, labeled.address].filter(Boolean).join("");
    const region = parseRegion(regionSource || labeled.address);
    data = {
      name: labeled.name.replace(/[^\u4e00-\u9fa5a-zA-Z·]/g, "").slice(0, 20),
      phone: labeled.phone,
      province: region.province,
      city: region.city,
      county: region.county,
      address: region.address || labeled.address,
    };
  } else {
    const multiline = parseMultiline(text);
    data = multiline ?? parseInline(text.replace(/\n+/g, " "));
  }

  return validateParsed(data, raw);
}

export function validateShippingForm(form: {
  name: string;
  phone: string;
  province?: string;
  city?: string;
  county?: string;
  address: string;
}): string[] {
  const errors: string[] = [];
  if (!form.name.trim()) errors.push("请填写收货人姓名");
  if (!form.phone.trim()) {
    errors.push("请填写联系电话");
  } else if (!PHONE_RE.test(form.phone.trim())) {
    errors.push("联系电话格式不正确，应为 11 位手机号");
  }
  if (!form.address.trim()) {
    errors.push("请填写详细地址");
  }
  if (!form.province?.trim() && !form.city?.trim() && !form.county?.trim()) {
    errors.push("请至少填写省、市或区/县中的一项");
  }
  return errors;
}

export function formatShippingAddress(parts: {
  province?: string | null;
  city?: string | null;
  county?: string | null;
  address?: string | null;
}) {
  return [parts.province, parts.city, parts.county, parts.address]
    .filter(Boolean)
    .join("");
}
