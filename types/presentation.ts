export type SceneTheme = "aurora" | "vault" | "ember" | "lumen" | "summit"

export type SceneLayout = "hero" | "insight" | "spotlight" | "erp" | "closing"

export interface SceneMetric {
  label: string
  value: string
  description: string
}

export interface SceneCard {
  title: string
  body: string
}

export interface SceneBullet {
  title: string
  body: string
}

export interface SceneConfig {
  id: string
  eyebrow: string
  title: string
  body: string
  theme: SceneTheme
  layout: SceneLayout
  erpPath?: string
  kicker?: string
  metrics?: SceneMetric[]
  cards?: SceneCard[]
  bullets?: SceneBullet[]
  asideTitle?: string
  asideBody?: string
  quote?: {
    text: string
    author: string
  }
}

export interface ErpSceneConfig {
  url: string
  fallbackMode: "handoff"
  displayUrl: string
  loadingTitle: string
  loadingBody: string
  blockedTitle: string
  blockedBody: string
  interactionTitle: string
  interactionBody: string
  presenterChecklist: string[]
}
