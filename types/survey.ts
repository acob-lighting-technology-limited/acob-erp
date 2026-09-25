export interface SystemSatisfactionSurvey {
  id: string
  user_id: string | null
  department: string | null
  role: string | null
  overall_rating: number
  speed_rating: number
  usability_rating: number
  modules_used: string[]
  module_ratings: Record<string, number>
  training_rating: "adequate" | "somewhat" | "inadequate" | null
  biggest_frustration: string | null
  desired_features: string | null
  is_anonymous: boolean
  created_at: string
  updated_at: string
}

export interface SurveyMetrics {
  totalResponses: number
  averageOverall: number
  averageSpeed: number
  averageUsability: number
  moduleAverages: Record<string, { avg: number; count: number }>
  trainingDistribution: {
    adequate: number
    somewhat: number
    inadequate: number
  }
  departmentCounts: Record<string, number>
}
