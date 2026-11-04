import { z } from "zod";

export const applicantProfileSchema = z.object({
  institution: z.string().min(1, "Institution is required"),
  studyLevel: z.enum(["undergraduate", "masters"]),
  currentYear: z.number().int().min(1).max(6),
  cgpa: z.number().min(0).max(4),
  householdIncomeLakhs: z.number().nullable(),
  paymentChannel: z.enum(["bkash_nagad", "card", "counter"]),
});

export type ApplicantProfileInput = z.infer<typeof applicantProfileSchema>;

export const communityReportInputSchema = z.object({
  noticeId: z.string().min(1, "Notice ID is required"),
  requirementId: z.string().optional(),
  reportType: z.enum([
    "requirement_changed",
    "contradictory_instruction",
    "service_delay",
    "outdated_or_scam",
  ]),
  observation: z.string().min(5, "Observation must be at least 5 characters"),
  evidenceUrlOrRef: z.string().min(1, "Evidence URL or reference is required"),
});

export type CommunityReportInput = z.infer<typeof communityReportInputSchema>;

export const readinessRecordSchema = z.object({
  noticeId: z.string().min(1, "Notice ID is required"),
  requirementId: z.string().min(1, "Requirement ID is required"),
  checked: z.boolean(),
  verifiedAgainstValue: z.string(),
  verifiedAgainstVersion: z.number().int().positive(),
  updatedAt: z.string(),
});

export type ReadinessRecordInput = z.infer<typeof readinessRecordSchema>;

