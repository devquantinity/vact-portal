import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { AuthError, canAccessCompany, requireApiRole } from "@/lib/auth/require";
import { recordUpload } from "@/lib/requests/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Multipart upload for one request. Clients may only upload to their own companies' requests;
 * staff and admins may upload on a client's behalf (uploadedByRole = STAFF).
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/requests/[id]/upload">) {
  try {
    const user = await requireApiRole("ADMIN", "STAFF", "CLIENT");
    const { id } = await ctx.params;
    const request = await prisma.documentRequest.findUnique({ where: { id }, select: { id: true, companyId: true, status: true } });
    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (!(await canAccessCompany(user, request.companyId))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

    const form = await req.formData();
    const entries = form.getAll("files").filter((v): v is File => typeof v !== "string");
    if (entries.length === 0) return NextResponse.json({ error: "Choose at least one file." }, { status: 400 });

    const files = [];
    for (const entry of entries) {
      files.push({ name: entry.name, bytes: Buffer.from(await entry.arrayBuffer()) });
    }
    const result = await recordUpload({
      requestId: request.id,
      files,
      uploadedById: user.id,
      uploadedByName: user.name,
      uploadedByRole: user.role === "CLIENT" ? "CLIENT" : "STAFF",
    });
    return NextResponse.json({
      ok: true,
      documents: result.documents.map((d) => ({ id: d.id, name: d.originalName, version: d.version, sizeBytes: d.sizeBytes })),
      remindersCancelled: result.remindersCancelled,
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    const message = err instanceof Error ? err.message : "Upload failed";
    const status = /not an accepted|larger than|does not look like|could not be verified|empty|accepts one file|closed|Choose at least/.test(message) ? 400 : 500;
    if (status === 500) console.error("upload failed", err);
    return NextResponse.json({ error: message }, { status });
  }
}
