/**
 * Instruction sent to the AI model (Bedrock / Claude) when summarizing .report files.
 */
export const REPORT_SUMMARY_PROMPT = `Analyze this report to check and make sure the user can know
1)  if the video is valid.
2) For a valid video all persons in the video should have their video turned on
3)  a clock must be present
4)  title "Chinmaya Gita Samarpanam" is present  on the screen not blocking any users.
5) Check the report to make sure audio was present in the file.
Show this uploaded file  is  Good or Needs Correction kind of summary that even low tech users can understand.`;
