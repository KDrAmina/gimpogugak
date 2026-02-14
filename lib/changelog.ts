export type ChangelogEntry = {
  version: string;
  date: string;
  changes: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.0.1",
    date: "2026-02-15",
    changes: [
      "Added My Info page (내 정보)",
      "Fixed Login bug (phone lookup, RLS)",
      "Version control & changelog system",
      "Student mobile navigation: horizontal layout",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-02-12",
    changes: [
      "Initial admin dashboard",
      "회원승인, 회원관리, 수업관리, 공지사항",
      "System info section",
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG[0]?.version ?? "1.0.1";
