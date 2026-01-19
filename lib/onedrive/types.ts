/**
 * OneDrive Integration Types
 * TypeScript types for Microsoft Graph API OneDrive responses
 */

// OneDrive item (file or folder) from Microsoft Graph API
export interface OneDriveItem {
  id: string
  name: string
  size: number
  createdDateTime: string
  lastModifiedDateTime: string
  webUrl: string
  parentReference?: {
    driveId: string
    id: string
    path: string
  }
  folder?: {
    childCount: number
  }
  file?: {
    mimeType: string
    hashes?: {
      quickXorHash?: string
      sha1Hash?: string
      sha256Hash?: string
    }
  }
  image?: {
    width: number
    height: number
  }
  video?: {
    width: number
    height: number
    duration: number
  }
  "@microsoft.graph.downloadUrl"?: string
}

// Response from listing folder contents
export interface OneDriveFolderResponse {
  value: OneDriveItem[]
  "@odata.nextLink"?: string
  "@odata.count"?: number
}

// Result from uploading a file
export interface OneDriveUploadResult {
  id: string
  name: string
  webUrl: string
  size: number
  createdDateTime: string
  lastModifiedDateTime: string
  file?: {
    mimeType: string
  }
}

// OAuth token response from Azure AD
export interface AzureTokenResponse {
  token_type: string
  expires_in: number
  ext_expires_in: number
  access_token: string
}

// OneDrive service configuration
export interface OneDriveConfig {
  tenantId: string
  clientId: string
  clientSecret: string
  userEmail: string
  paymentsFolder: string
  projectsFolder: string
}

// Simplified file item for UI
export interface FileItem {
  id: string
  name: string
  path: string
  size: number
  isFolder: boolean
  mimeType?: string
  lastModified: string
  webUrl: string
  downloadUrl?: string
  childCount?: number
  thumbnailUrl?: string
}

// File type categories for icons/previews
export type FileCategory =
  | "folder"
  | "image"
  | "video"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "pdf"
  | "archive"
  | "code"
  | "audio"
  | "unknown"

// Sync status for payment documents
export type SyncStatus = "pending" | "syncing" | "synced" | "error"

export interface PaymentDocumentSync {
  documentId: string
  onedriveId?: string
  onedrivePath?: string
  syncStatus: SyncStatus
  syncedAt?: string
  errorMessage?: string
}
