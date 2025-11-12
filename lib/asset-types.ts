/**
 * Asset Type Codes for ACOB Company
 * Format: ACOB/HQ/{CODE}/{YEAR}/{SERIAL}
 */

export interface AssetType {
  label: string
  code: string
  requiresSerialModel: boolean // True for Laptop and Desktop
}

export const ASSET_TYPES: AssetType[] = [
  { label: "Desktop", code: "DSKST", requiresSerialModel: true },
  { label: "Laptop", code: "LAP", requiresSerialModel: true },
  { label: "Telephone", code: "TELPH", requiresSerialModel: false },
  { label: "Fan", code: "FAN", requiresSerialModel: false },
  { label: "Printer", code: "PRINT", requiresSerialModel: false },
  { label: "Router", code: "ROUTER", requiresSerialModel: false },
  { label: "Television", code: "TELV", requiresSerialModel: false },
  { label: "Office Safe Drawer", code: "SAVEDRW", requiresSerialModel: false },
  { label: "Extension Box", code: "EXTEN", requiresSerialModel: false },
  { label: "Notice Board (White)", code: "WHITE/BRD", requiresSerialModel: false },
  { label: "Notice Board (Black)", code: "BLACK/BRD", requiresSerialModel: false },
  { label: "Office Table", code: "TB", requiresSerialModel: false },
  { label: "Table Side Drawer", code: "OFF/DRAW", requiresSerialModel: false },
  { label: "Chair", code: "CHAIR", requiresSerialModel: false },
  { label: "Executive Chair", code: "EX/CHAIR", requiresSerialModel: false },
  { label: "Deep Freezer", code: "D/FREEZER", requiresSerialModel: false },
  { label: "Microwave", code: "MICROWAVE", requiresSerialModel: false },
  { label: "Air Conditioner", code: "AC", requiresSerialModel: false },
  { label: "Visibility Banner", code: "VBANNER", requiresSerialModel: false },
  { label: "Generator", code: "GEN", requiresSerialModel: false },
]

export const ASSET_TYPE_MAP = ASSET_TYPES.reduce((acc, type) => {
  acc[type.code] = type
  return acc
}, {} as Record<string, AssetType>)

export const ASSIGNMENT_TYPES = [
  { value: "individual", label: "Individual Staff" },
  { value: "department", label: "Department" },
  { value: "office", label: "Office" },
] as const

/**
 * Get asset type configuration by code
 */
export function getAssetTypeByCode(code: string): AssetType | undefined {
  return ASSET_TYPE_MAP[code]
}

/**
 * Get asset type configuration by label
 */
export function getAssetTypeByLabel(label: string): AssetType | undefined {
  return ASSET_TYPES.find(type => type.label === label)
}

/**
 * Check if asset type requires serial number and model
 */
export function requiresSerialAndModel(typeCode: string): boolean {
  return ASSET_TYPE_MAP[typeCode]?.requiresSerialModel ?? false
}

/**
 * Generate unique code preview
 */
export function generateUniqueCodePreview(typeCode: string, year: number, serial: string = "001"): string {
  return `ACOB/HQ/${typeCode}/${year}/${serial}`
}

/**
 * Parse unique code into components
 */
export function parseUniqueCode(uniqueCode: string): {
  prefix: string
  location: string
  typeCode: string
  year: string
  serial: string
} | null {
  const parts = uniqueCode.split('/')
  if (parts.length !== 5) return null

  return {
    prefix: parts[0],
    location: parts[1],
    typeCode: parts[2],
    year: parts[3],
    serial: parts[4],
  }
}
