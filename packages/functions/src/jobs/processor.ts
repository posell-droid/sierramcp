import type { SQSHandler } from "aws-lambda";

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);
      console.log("Processing job:", body);

      // TODO: Implement job processing logic based on job type
      switch (body.type) {
        case "send_email":
          // Handle email sending
          break;
        case "process_upload":
          // Handle file processing
          break;
        default:
          console.log("Unknown job type:", body.type);
      }
    } catch (error) {
      console.error("Error processing job:", error);
      throw error; // Re-throw to trigger retry
    }
  }
};
