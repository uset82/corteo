import { useEffect, useState } from 'react';
import { loadTimelineView, saveTimelineView } from '../../persist/sessionPrefs';

export function useMusicMapVisibility(projectId: string | undefined, timelineId: string | undefined) {
  const [visible, setVisible] = useState(() => projectId && timelineId
    ? loadTimelineView(projectId, timelineId)?.musicMapVisible ?? false : false);
  useEffect(() => {
    setVisible(projectId && timelineId ? loadTimelineView(projectId, timelineId)?.musicMapVisible ?? false : false);
  }, [projectId, timelineId]);
  const toggle = () => {
    const next = !visible;
    setVisible(next);
    if (projectId && timelineId) saveTimelineView(projectId, timelineId, { musicMapVisible: next });
  };
  return { visible, toggle };
}
