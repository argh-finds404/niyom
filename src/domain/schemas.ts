import { z } from "zod";

export const applicantProfileSchema = z.object({
  institution: z.string().trim().min(1, "Institution is required").max(200, "Institution name is too long"),
  studyLevel: z.enum(["undergraduate", "masters"]),
  currentYear: z.number().int().min(1, "Year must be between 1 and 6").max(6, "Year must be between 1 and 6"),
  cgpa: z.number().min(0, "CGPA must be between 0.00 and 4.00").max(4, "CGPA must be between 0.00 and 4.00"),
  householdIncomeLakhs: z
    .number()
    .min(0, "Income cannot be negative.")
    .max(1000, "Income exceeds valid range.")
    .nullable(),
  paymentChannel: z.enum(["bkash_nagad", "card", "counter"]),
});

export type ApplicantProfileInput = z.infer<typeof applicantProfileSchema>;

export const communityReportInputSchema = z.object({
  noticeId: z.string().trim().min(1, "Notice ID is required").max(100),
  requirementId: z.string().trim().min(1).max(100).optional(),
  reportType: z.enum([
    "requirement_changed",
    "contradictory_instruction",
    "service_delay",
    "outdated_or_scam",
  ]),
  observation: z
    .string()
    .trim()
    .min(5, "Observation must be at least 5 characters")
    .max(1000, "Observation must be under 1000 characters"),
  evidenceUrlOrRef: z
    .string()
    .trim()
    .min(1, "Evidence URL or reference is required")
    .max(300, "Evidence reference must be under 300 characters"),
});

export type CommunityReportInput = z.infer<typeof communityReportInputSchema>;

export const communityReportSchema = communityReportInputSchema.extend({
  id: z.string().min(1),
  submittedAt: z.string().min(1),
  verificationStatus: z.enum(["pending_verification", "corroborated_pattern"]),
  corroborationCount: z.number().int().positive(),
});

export const communityReportCorroborateSchema = z.object({
  id: z.string().trim().min(1, "Report ID is required").max(100),
});

const isoTimestamp = z
  .string()
  .max(40)
  .refine((s) => {
    const t = Date.parse(s);
    // A bounded range: every store can hold it, and a wrong clock cannot pin a check far into the future.
    return t >= Date.UTC(2000, 0, 1) && t <= Date.UTC(2100, 0, 1);
  }, "Must be an ISO-8601 timestamp between 2000 and 2100");

export const readinessRecordSchema = z.object({
  noticeId: z.string().trim().min(1, "Notice ID is required").max(100),
  requirementId: z.string().trim().min(1, "Requirement ID is required").max(100),
  checked: z.boolean(),
  verifiedAgainstValue: z.string().max(2000),
  verifiedAgainstVersion: z.number().int().positive().max(1000),
  updatedAt: isoTimestamp,
});

export type ReadinessRecordInput = z.infer<typeof readinessRecordSchema>;

export const evaluateRequestSchema = z.object({
  noticeId: z.string().trim().min(1, "Notice ID is required"),
  versionNumber: z.number().int().positive().optional(),
  profile: applicantProfileSchema.optional(),
  readinessRecords: z.array(readinessRecordSchema).max(200).optional(),
});

export type EvaluateRequestInput = z.infer<typeof evaluateRequestSchema>;

export const compareQuerySchema = z.object({
  notice: z.string().trim().min(1, "Unknown or missing `notice`."),
  from: z.coerce.number().int().positive().optional(),
  to: z.coerce.number().int().positive().optional(),
});

export const syncStatePatchSchema = z.object({
  profile: applicantProfileSchema.optional(),
  readinessRecords: z.array(readinessRecordSchema).max(500).optional(),
  activeVersions: z
    .record(z.string().max(100), z.number().int().positive())
    .refine((o) => Object.keys(o).length <= 50, "Too many dossiers in one update")
    .optional(),
  demoScenarioStage: z.enum(["v1_ready", "v2_updated", "custom"]).optional(),
});

export type SyncStatePatchInput = z.infer<typeof syncStatePatchSchema>;

export const dossierVersionPatchSchema = z.object({
  activeVersionNumber: z.number().int().positive().max(1000),
});
