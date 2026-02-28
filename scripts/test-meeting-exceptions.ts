import { appendMeetingExceptionRows } from "@/lib/meeting-exceptions-sheet";

async function main() {
  try {
    const timestamp = new Date().toISOString();

    const rows: string[][] = [
      [
        timestamp,
        "test-host@example.com", // hostEmail
        "test-host-id", // hostUserId
        "CMS_ABCDE", // meetingCmsxId
        "CMS_ABCDE – Test Meeting", // meetingTitle
        "test-participant@example.com", // participant email
        "PENDING",
        "",
      ],
    ];

    console.log("Appending test meeting exception row…");
    await appendMeetingExceptionRows(rows);
    console.log("Success: test row appended to meeting exception list sheet.");
  } catch (err) {
    console.error("Error while testing meeting exception append:", err);
    process.exitCode = 1;
  }
}

main();

