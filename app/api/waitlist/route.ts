import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { joinWaitlistSchema } from "@/lib/waitlist/schema";

/**
 * Join the launch waitlist. There is deliberately no GET — the previous
 * implementation exposed every signup's email address to anyone who asked.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = joinWaitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Enter a valid email address",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { email } = parsed.data;

  try {
    // Signing up twice is a success, not an error — hence upsert.
    await prisma.waitlist.upsert({
      where: { email },
      update: {},
      create: { email, source: "landing" },
    });
  } catch (err) {
    console.error("Waitlist signup failed:", err);
    return NextResponse.json(
      { error: "Couldn't save your email right now. Please try again." },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { success: true, message: "You're on the list." },
    { status: 201 },
  );
}
