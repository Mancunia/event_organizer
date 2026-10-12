import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeCode } from "@/lib/codes";
import { getEventBySlug } from "@/lib/events";
import { issueChallenge } from "@/lib/invites";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const body = z.object({ slug: z.string(), code: z.string() });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  const code = parsed.success ? normalizeCode(parsed.data.code) : null;
  if (!parsed.success || !code) return NextResponse.json({ error: "That doesn't look like an invite code." }, { status: 400 });

  if (!(await rateLimit(`challenge:ip:${await clientIp()}`, 20, 600))) {
    return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
  }

  const event = await getEventBySlug(parsed.data.slug);
  const nonce = event ? await issueChallenge(event.id, code) : null;
  if (!nonce) return NextResponse.json({ error: "We couldn't find that invite code." }, { status: 404 });
  return NextResponse.json({ nonce });
}
