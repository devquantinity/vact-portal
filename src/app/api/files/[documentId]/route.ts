import { NextResponse, type NextRequest } from "next/server";
import { Readable } from "node:stream";
import { prisma } from "@/lib/db";
import { AuthError, canAccessCompany, requireApiRole } from "@/lib/auth/require";
import { verifyFileSignature } from "@/lib/files/signed-url";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INLINE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

/**
 * Serves a stored file. Requires a valid session AND a signed, 10-minute URL issued for that same user.
 * Files are never reachable from a public path.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/files/[documentId]">) {
  try {
    const user = await requireApiRole("ADMIN", "STAFF", "CLIENT");
    const { documentId } = await ctx.params;
    const sp = req.nextUrl.searchParams;
    if (!verifyFileSignature(documentId, user.id, sp.get("exp"), sp.get("sig"))) {
      return NextResponse.json({ error: "This download link has expired. Reload the page to get a new one." }, { status: 403 });
    }
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: { request: { select: { companyId: true } } },
    });
    if (!doc) return NextResponse.json({ error: "File not found" }, { status: 404 });
    if (!(await canAccessCompany(user, doc.request.companyId))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    if (!(await storage().exists(doc.storageKey))) return NextResponse.json({ error: "File is missing from storage" }, { status: 410 });

    const stream = await storage().getStream(doc.storageKey);
    const forceDownload = sp.get("download") === "1";
    const disposition = `${forceDownload || !INLINE_TYPES.has(doc.mimeType) ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`;
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Length": String(doc.sizeBytes),
        "Content-Disposition": disposition,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("file download failed", err);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
