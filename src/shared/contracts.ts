export type SkillSource = "personal" | "project" | "plugin" | "configured" | "other";

export type SkillSummary = {
  id: string;
  name: string;
  description: string;
  path: string;
  source: SkillSource;
  modifiedAt: string;
  observedAt: string | null;
  observedSessionId: string | null;
  sessionObservedAt: string | null;
};

export type SkillDetail = SkillSummary & {
  content: string;
};

export type ActivityRecord = {
  timestamp: string;
  sessionId: string | null;
  turnId: string | null;
  toolName: string | null;
  path: string;
  detection: "observed-read" | "session-log-read";
};

export type SkillSnapshot = {
  generatedAt: string;
  skills: SkillSummary[];
  activity: ActivityRecord[];
  roots: string[];
  notices: string[];
  currentSession: {
    trackingAvailable: boolean;
    observedSkillCount: number;
    sessionIds: string[];
    primarySessionId: string | null;
    activityRevision: string;
  };
};

export type SkillSessionStatus = {
  trackingAvailable: boolean;
  sessionIds: string[];
  primarySessionId: string | null;
  activityRevision: string;
  checkedAt: string;
};
