import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  lookupConfirmation,
  lookupConfirmationByPhone,
  sendConfirmationEmail,
} from "@/lib/public-confirmation";
import { sendWatiTemplateMessage } from "@/lib/notifications/channels/whatsapp";

const schema = z.object({
  lookupType: z.enum(["email", "phone"]),
  query: z.string().min(3),
});

const normalizePhoneDigits = (value: string) => value.replace(/[^0-9]/g, "");

function formatUpcomingSaturdayLabel(phoneDigits: string): string {
  const now = new Date();
  const nextSaturday = new Date(now);
  const daysUntilSaturday = ((6 - now.getDay() + 7) % 7) || 7;
  nextSaturday.setDate(now.getDate() + daysUntilSaturday);

  if (phoneDigits.startsWith("1")) {
    const month = nextSaturday.toLocaleString("en-US", {
      month: "long",
      timeZone: "America/New_York",
    });
    const day = nextSaturday.toLocaleString("en-US", {
      day: "numeric",
      timeZone: "America/New_York",
    });
    const year = nextSaturday.toLocaleString("en-US", {
      year: "numeric",
      timeZone: "America/New_York",
    });
    return `${month} ${day} ${year} 10AM EST`;
  }

  const month = nextSaturday.toLocaleString("en-US", {
    month: "long",
    timeZone: "Asia/Kolkata",
  });
  const day = nextSaturday.toLocaleString("en-US", {
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const year = nextSaturday.toLocaleString("en-US", {
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  return `${month} ${day} ${year} 7.30PM IST`;
}

// POST /api/public/confirm-registration
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (parsed.data.lookupType === "email") {
    const email = parsed.data.query.trim().toLowerCase();
    const emailValid = z.string().email().safeParse(email);
    if (!emailValid.success) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }
    const lookup = await lookupConfirmation(email);
    if (!lookup.valid) {
      // Do not leak participant list; return generic success.
      return NextResponse.json({
        message:
          "If your email is registered, you will receive a confirmation email shortly.",
      });
    }

    await sendConfirmationEmail(lookup);
    return NextResponse.json({
      message: "Confirmation email sent.",
    });
  }

  const phoneDigits = normalizePhoneDigits(parsed.data.query);
  if (phoneDigits.length < 10) {
    return NextResponse.json(
      { error: "Enter a valid WhatsApp phone number." },
      { status: 400 },
    );
  }
  const phoneLookup = await lookupConfirmationByPhone(phoneDigits);
  if (!phoneLookup) {
    return NextResponse.json({
      message:
        "If your WhatsApp number is registered, you will receive meeting information shortly.",
    });
  }

  const primaryMeeting =
    phoneLookup.meetings.find((m) => m.link?.trim()) ?? phoneLookup.meetings[0];
  const participantName =
    phoneLookup.displayName?.split(";")[0]?.trim() || "Participant";
  const greetingFirstName =
    phoneLookup.displayName?.trim().split(/\s+/)[0]?.trim() || participantName;
  const registeredEmail = phoneLookup.email;
  const meetingNumber = primaryMeeting?.meetingNumber?.trim() || "TBD";
  const meetingLink = primaryMeeting?.link?.trim() || "Not available";
  const hostEmail = primaryMeeting?.hostEmail?.trim() || "Not available";
  const hostPhone = primaryMeeting?.hostPhone?.trim() || "Not available";
  const meetingStartSheet = primaryMeeting?.startTime?.trim() || "";
  const meetingStartSaturday = formatUpcomingSaturdayLabel(
    phoneLookup.whatsappDialDigits,
  );

  const whatsappSend = phoneLookup.isHost
    ? await sendWatiTemplateMessage(phoneLookup.whatsappDialDigits, "host_meeting_info", [
        { name: "1", value: greetingFirstName },
        { name: "2", value: registeredEmail },
        { name: "3", value: "May 9th" },
        { name: "4", value: meetingLink },
        { name: "5", value: meetingNumber },
        { name: "6", value: hostEmail },
        {
          name: "6",
          value: meetingStartSheet || meetingStartSaturday,
        },
        {
          name: "7",
          value: String((phoneLookup.hostMeetingParticipants ?? []).length),
        },
      ])
    : await sendWatiTemplateMessage(phoneLookup.whatsappDialDigits, "participant_meeting_info_v5", [
        { name: "1", value: participantName },
        { name: "2", value: registeredEmail },
        { name: "3", value: "May 9th" },
        { name: "4", value: meetingLink },
        { name: "5", value: meetingNumber },
        { name: "6", value: "May 9th Saturday @ 7am PDT / 10am EDT/ 7:30pm India / 2pm GMT" },
      ]);
  if (!whatsappSend.success) {
    return NextResponse.json(
      {
        error:
          whatsappSend.error ??
          "Unable to send WhatsApp message. Please try email search.",
      },
      { status: 502 },
    );
  }
  return NextResponse.json({
    message: "Meeting information sent on WhatsApp.",
  });
}

