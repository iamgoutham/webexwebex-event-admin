/** One meeting in the Google Sheet "Meeting Info" JSON `meetings` array. */
export type SheetMeeting = {
  title?: string;
  start?: string;
  end?: string;
  state?: string;
  meetingNumber?: string;
  webLink?: string;
  invitees?: unknown[];
};
