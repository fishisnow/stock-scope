const INDUSTRY_LABELS_EN: Record<string, string> = {
  "半导体": "Semiconductors",
  "消费电子": "Consumer Electronics",
  "光学光电子": "Optoelectronics",
  "通信设备": "Telecom Equipment",
  "计算机应用": "Computer Applications",
  "软件开发": "Software Development",
  "传媒": "Media",
  "化学制药": "Chemical Pharma",
  "生物制品": "Biologics",
  "中药": "Traditional Chinese Medicine",
  "医疗器械": "Medical Devices",
  "医疗服务": "Healthcare Services",
  "食品饮料": "Food & Beverage",
  "家电": "Home Appliances",
  "汽车整车": "Automobiles",
  "汽车零部件": "Auto Parts",
  "锂电池": "Lithium Batteries",
  "光伏": "Photovoltaics",
  "风电": "Wind Power",
  "军工": "Defense",
  "化工": "Chemicals",
  "有色金属": "Nonferrous Metals",
  "钢铁": "Steel",
  "煤炭": "Coal",
  "电力": "Power Utilities",
  "环保": "Environmental Protection",
  "建筑": "Construction",
  "房地产": "Real Estate",
  "银行": "Banks",
  "证券": "Brokers",
  "保险": "Insurance",
  "物流": "Logistics",
  "航空": "Airlines",
  "机场": "Airports",
  "港口": "Ports",
  "高速": "Expressways",
  "铁路": "Railways",
  "航运": "Shipping",
}

const SECTOR_LABELS_EN: Record<string, string> = {
  "科技": "Technology",
  "医药": "Healthcare",
  "消费": "Consumer",
  "汽车": "Automotive",
  "新能源": "New Energy",
  "军工": "Defense",
  "原材料": "Materials",
  "公用事业和基建": "Utilities & Infrastructure",
  "金融": "Financials",
  "交运物流": "Transportation & Logistics",
}

function isEnglishLocale(locale: string) {
  return locale.toLowerCase().startsWith("en")
}

export function getLocalizedIndustryName(industry: string, locale: string) {
  if (!isEnglishLocale(locale)) return industry
  return INDUSTRY_LABELS_EN[industry] || industry
}

export function getLocalizedSectorName(sector: string, locale: string) {
  if (!isEnglishLocale(locale)) return sector
  return SECTOR_LABELS_EN[sector] || sector
}
