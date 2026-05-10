import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // In production: decode the Firebase token and fetch real workspace data.
    return NextResponse.json({
      userId: "stub_user",
      workspaces: [
        { id: "ws_default", name: "My Workspace", role: "admin" },
      ],
      defaultWorkspaceId: "ws_default",
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
