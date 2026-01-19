import { NextRequest, NextResponse } from "next/server"
import { getPrisma, initDatabaseUrl } from "@repo/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await initDatabaseUrl()
    const prisma = await getPrisma()
    const { token } = await params

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        tenant: {
          select: { name: true },
        },
      },
    })

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      )
    }

    // Check if expired
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 410 }
      )
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: "This invitation has already been accepted" },
        { status: 410 }
      )
    }

    // Get inviter name if available
    let inviterName: string | null = null
    if (invitation.invitedById) {
      const inviter = await prisma.user.findUnique({
        where: { id: invitation.invitedById },
        select: { name: true, email: true },
      })
      inviterName = inviter?.name || inviter?.email || null
    }

    return NextResponse.json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      tenantName: invitation.tenant.name,
      inviterName,
      expiresAt: invitation.expiresAt.toISOString(),
    })
  } catch (error) {
    console.error("Error fetching invitation:", error)
    return NextResponse.json(
      { error: "Failed to fetch invitation" },
      { status: 500 }
    )
  }
}
