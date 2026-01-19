/**
 * OneDrive Service
 * Handles all interactions with Microsoft Graph API for OneDrive operations
 * Uses Application-Only (Client Credentials) authentication
 */

import type {
  OneDriveItem,
  OneDriveFolderResponse,
  OneDriveUploadResult,
  AzureTokenResponse,
  OneDriveConfig,
  FileItem,
  FileCategory,
} from "./types"

// Token cache to avoid unnecessary auth requests
let cachedToken: { token: string; expiresAt: number } | null = null

export class OneDriveService {
  private config: OneDriveConfig

  constructor() {
    this.config = {
      tenantId: process.env.AZURE_TENANT_ID || "",
      clientId: process.env.AZURE_CLIENT_ID || "",
      clientSecret: process.env.AZURE_CLIENT_SECRET || "",
      userEmail: process.env.ONEDRIVE_USER_EMAIL || "",
      paymentsFolder: process.env.ONEDRIVE_PAYMENTS_FOLDER || "/Payments",
      projectsFolder: process.env.ONEDRIVE_PROJECTS_FOLDER || "/Projects",
    }
  }

  /**
   * Check if OneDrive integration is enabled and configured
   */
  isEnabled(): boolean {
    return (
      process.env.ONEDRIVE_ENABLED === "true" &&
      !!this.config.tenantId &&
      !!this.config.clientId &&
      !!this.config.clientSecret &&
      !!this.config.userEmail
    )
  }

  /**
   * Get access token using client credentials flow
   */
  private async getAccessToken(): Promise<string> {
    // Check cache first
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
      return cachedToken.token
    }

    const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`

    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    })

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to get access token: ${error}`)
    }

    const data: AzureTokenResponse = await response.json()

    // Cache the token
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    }

    return data.access_token
  }

  /**
   * Make authenticated request to Microsoft Graph API
   */
  private async graphRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken()
    const baseUrl = `https://graph.microsoft.com/v1.0/users/${this.config.userEmail}/drive`

    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Graph API error (${response.status}): ${error}`)
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return {} as T
    }

    return response.json()
  }

  /**
   * List contents of a folder
   */
  async listFolder(folderPath: string): Promise<FileItem[]> {
    const encodedPath = encodeURIComponent(folderPath.replace(/^\//, ""))
    const endpoint = folderPath === "/" || folderPath === "" ? "/root/children" : `/root:/${encodedPath}:/children`

    const response = await this.graphRequest<OneDriveFolderResponse>(endpoint)

    return response.value.map((item) => this.transformItem(item, folderPath))
  }

  /**
   * Get a single item (file or folder) metadata
   */
  async getItem(itemPath: string): Promise<FileItem> {
    const encodedPath = encodeURIComponent(itemPath.replace(/^\//, ""))
    const endpoint = `/root:/${encodedPath}`

    const item = await this.graphRequest<OneDriveItem>(endpoint)
    const parentPath = itemPath.substring(0, itemPath.lastIndexOf("/")) || "/"

    return this.transformItem(item, parentPath)
  }

  /**
   * Upload a file to OneDrive
   * For files < 4MB, uses simple upload
   * For larger files, would need resumable upload (not implemented yet)
   */
  async uploadFile(
    filePath: string,
    content: Uint8Array | ArrayBuffer,
    mimeType?: string
  ): Promise<OneDriveUploadResult> {
    const encodedPath = encodeURIComponent(filePath.replace(/^\//, ""))
    const endpoint = `/root:/${encodedPath}:/content`

    const token = await this.getAccessToken()
    const baseUrl = `https://graph.microsoft.com/v1.0/users/${this.config.userEmail}/drive`

    // Convert to Uint8Array if ArrayBuffer
    const bodyContent = content instanceof ArrayBuffer ? new Uint8Array(content) : content

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": mimeType || "application/octet-stream",
      },
      body: bodyContent as BodyInit,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to upload file: ${error}`)
    }

    return response.json()
  }

  /**
   * Create a folder (creates parent folders if needed)
   */
  async createFolder(folderPath: string): Promise<OneDriveItem> {
    const pathParts = folderPath.replace(/^\//, "").split("/")
    let currentPath = ""
    let lastItem: OneDriveItem | null = null

    for (const part of pathParts) {
      const parentPath = currentPath || "root"
      const endpoint = currentPath === "" ? "/root/children" : `/root:/${encodeURIComponent(currentPath)}:/children`

      try {
        lastItem = await this.graphRequest<OneDriveItem>(endpoint, {
          method: "POST",
          body: JSON.stringify({
            name: part,
            folder: {},
            "@microsoft.graph.conflictBehavior": "replace",
          }),
        })
      } catch (error: unknown) {
        // Folder might already exist, try to continue
        if (error instanceof Error && error.message.includes("nameAlreadyExists")) {
          // Folder exists, continue with next part
        } else {
          throw error
        }
      }

      currentPath = currentPath ? `${currentPath}/${part}` : part
    }

    return lastItem!
  }

  /**
   * Delete a file or folder
   */
  async deleteItem(itemPath: string): Promise<void> {
    const encodedPath = encodeURIComponent(itemPath.replace(/^\//, ""))
    const endpoint = `/root:/${encodedPath}`

    await this.graphRequest(endpoint, { method: "DELETE" })
  }

  /**
   * Get download URL for a file
   */
  async getDownloadUrl(filePath: string): Promise<string> {
    const encodedPath = encodeURIComponent(filePath.replace(/^\//, ""))
    const endpoint = `/root:/${encodedPath}?select=@microsoft.graph.downloadUrl`

    const item = await this.graphRequest<OneDriveItem>(endpoint)

    if (!item["@microsoft.graph.downloadUrl"]) {
      throw new Error("Download URL not available")
    }

    return item["@microsoft.graph.downloadUrl"]
  }

  /**
   * Get embeddable preview URL for Office documents
   */
  async getPreviewUrl(filePath: string): Promise<string> {
    const encodedPath = encodeURIComponent(filePath.replace(/^\//, ""))
    const endpoint = `/root:/${encodedPath}/preview`

    const response = await this.graphRequest<{ getUrl: string }>(endpoint, {
      method: "POST",
    })

    return response.getUrl
  }

  /**
   * Search for files in OneDrive
   */
  async searchFiles(query: string, folderPath?: string): Promise<FileItem[]> {
    const searchQuery = encodeURIComponent(query)
    const endpoint = `/root/search(q='${searchQuery}')`

    const response = await this.graphRequest<OneDriveFolderResponse>(endpoint)

    let items = response.value.map((item) => this.transformItem(item, item.parentReference?.path || "/"))

    // Filter by folder path if specified
    if (folderPath) {
      items = items.filter((item) => item.path.startsWith(folderPath))
    }

    return items
  }

  /**
   * Get payments folder path
   */
  getPaymentsPath(departmentName: string, paymentId: string, fileName?: string): string {
    const basePath = `${this.config.paymentsFolder}/${departmentName}/${paymentId}`
    return fileName ? `${basePath}/${fileName}` : basePath
  }

  /**
   * Get projects folder path
   */
  getProjectsPath(): string {
    return this.config.projectsFolder
  }

  /**
   * Transform Graph API item to simplified FileItem
   */
  private transformItem(item: OneDriveItem, parentPath: string): FileItem {
    const isFolder = !!item.folder
    const path = `${parentPath}/${item.name}`.replace(/\/+/g, "/")

    return {
      id: item.id,
      name: item.name,
      path,
      size: item.size,
      isFolder,
      mimeType: item.file?.mimeType,
      lastModified: item.lastModifiedDateTime,
      webUrl: item.webUrl,
      downloadUrl: item["@microsoft.graph.downloadUrl"],
      childCount: item.folder?.childCount,
    }
  }
}

/**
 * Determine file category from MIME type or extension
 */
export function getFileCategory(mimeType?: string, fileName?: string): FileCategory {
  if (!mimeType && !fileName) return "unknown"

  // Check MIME type first
  if (mimeType) {
    if (mimeType.startsWith("image/")) return "image"
    if (mimeType.startsWith("video/")) return "video"
    if (mimeType.startsWith("audio/")) return "audio"
    if (mimeType === "application/pdf") return "pdf"
    if (
      mimeType.includes("spreadsheet") ||
      mimeType.includes("excel") ||
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
      return "spreadsheet"
    if (
      mimeType.includes("presentation") ||
      mimeType.includes("powerpoint") ||
      mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    )
      return "presentation"
    if (
      mimeType.includes("document") ||
      mimeType.includes("word") ||
      mimeType === "application/msword" ||
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
      return "document"
    if (mimeType.includes("zip") || mimeType.includes("compressed")) return "archive"
    if (
      mimeType.includes("javascript") ||
      mimeType.includes("json") ||
      mimeType.includes("xml") ||
      mimeType.includes("html")
    )
      return "code"
  }

  // Fallback to extension
  if (fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase()
    switch (ext) {
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "webp":
      case "svg":
      case "bmp":
        return "image"
      case "mp4":
      case "mov":
      case "avi":
      case "mkv":
      case "webm":
        return "video"
      case "mp3":
      case "wav":
      case "ogg":
      case "flac":
        return "audio"
      case "pdf":
        return "pdf"
      case "doc":
      case "docx":
      case "odt":
      case "rtf":
        return "document"
      case "xls":
      case "xlsx":
      case "ods":
      case "csv":
        return "spreadsheet"
      case "ppt":
      case "pptx":
      case "odp":
        return "presentation"
      case "zip":
      case "rar":
      case "7z":
      case "tar":
      case "gz":
        return "archive"
      case "js":
      case "ts":
      case "jsx":
      case "tsx":
      case "py":
      case "java":
      case "css":
      case "html":
      case "json":
      case "xml":
        return "code"
    }
  }

  return "unknown"
}

// Singleton instance
let oneDriveInstance: OneDriveService | null = null

export function getOneDriveService(): OneDriveService {
  if (!oneDriveInstance) {
    oneDriveInstance = new OneDriveService()
  }
  return oneDriveInstance
}
