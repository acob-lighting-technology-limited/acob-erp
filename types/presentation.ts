export type SceneTheme = "aurora" | "vault" | "ember" | "lumen" | "summit"

export type SceneLayout = "hero" | "insight" | "spotlight" | "erp" | "closing" | "cover" | "titleOnly"

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

export interface SceneCoverMeta {
  presenter: string
  department: string
  date: string
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
  coverMeta?: SceneCoverMeta
  asideTitle?: string
  asideBody?: string
  quote?: {
    text: string
    author: string
  }
  visual?: {
    src: string
    alt: string
    caption?: string
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
