import { NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"

const log = logger("api-project-tasks-deprecated")

function buildDeprecatedResponse(projectId: string) {
  return NextResponse.json(
    {
      error: "Project tasks have been deprecated. Create a goal-linked task from the task management flow instead.",
      redirect_to: `/admin/tasks?project=${projectId}`,
    },
    { status: 410 }
  )
}

export async function PATCH(_: NextRequest, { params }: { params: { id: string } }) {
  log.warn({ projectId: params.id }, "Attempted to create a deprecated project task")
  return buildDeprecatedResponse(params.id)
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return PATCH(request, { params })
}
