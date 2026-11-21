import { Announcement, UserRole } from '../types/simtaq';

export interface AnnouncementViewerContext {
  role: UserRole;
  classId?: string;
  halaqahId?: string;
}

export function filterActiveAnnouncements(
  announcements: Announcement[],
  viewer: AnnouncementViewerContext,
  nowIso: string
): Announcement[] {
  const nowTime = Date.parse(nowIso);

  return announcements
    .filter((item) => {
      if (!item.is_published || item.is_archived) return false;
      const startTime = Date.parse(item.start_at);
      const endTime = Date.parse(item.end_at);
      if (Number.isFinite(startTime) && nowTime < startTime) return false;
      if (Number.isFinite(endTime) && nowTime > endTime) return false;

      if (viewer.role === 'super_admin' || viewer.role === 'school_admin') {
        return true;
      }

      switch (item.target_audience) {
        case 'all':
          return true;
        case 'teacher':
          return viewer.role === 'teacher';
        case 'student':
          return viewer.role === 'student';
        case 'guardian':
          return viewer.role === 'guardian';
        case 'class':
          return Boolean(viewer.classId && item.target_ref_id === viewer.classId);
        case 'halaqah':
          return Boolean(viewer.halaqahId && item.target_ref_id === viewer.halaqahId);
        default:
          return false;
      }
    })
    .sort((a, b) => {
      const priorityRank: Record<Announcement['priority'], number> = {
        Mendesak: 0,
        Penting: 1,
        Normal: 2,
      };
      const pDiff = priorityRank[a.priority] - priorityRank[b.priority];
      if (pDiff !== 0) return pDiff;
      return b.created_at.localeCompare(a.created_at);
    });
}
