import { useState, useEffect } from 'react';
import type { ActivityItem } from '../../types';
import { apiFetch } from '../../services/api';

interface ActivityFeedProps {
  agentId: string;
}

export function ActivityFeed({ agentId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadActivities() {
      setLoading(true);
      try {
        // Get recent sessions
        const sessionsRes = await apiFetch(`/api/agents/${agentId}/sessions?limit=5`);
        if (!sessionsRes.ok) {
          setActivities([]);
          return;
        }

        const { sessions } = await sessionsRes.json();
        const allActivities: ActivityItem[] = [];

        // Parse each session for activity
        for (const sessionId of sessions.slice(0, 3)) {
          const transcriptRes = await apiFetch(
            `/api/sessions/transcript?agentId=${encodeURIComponent(agentId)}&sessionId=${encodeURIComponent(sessionId)}&maxLines=20`
          );
          if (transcriptRes.ok) {
            const { lines } = await transcriptRes.json();
            for (const line of lines) {
              try {
                const event = JSON.parse(line);
                if (event.type === 'assistant' && event.message?.content) {
                  const content = typeof event.message.content === 'string'
                    ? event.message.content
                    : event.message.content[0]?.text || '';

                  if (content.trim()) {
                    allActivities.push({
                      id: `${sessionId}-${event.timestamp || Date.now()}`,
                      agentId,
                      type: 'message',
                      content: content.slice(0, 200),
                      timestamp: event.timestamp || new Date().toISOString(),
                    });
                  }
                }
              } catch {
                // Skip unparseable lines
              }
            }
          }
        }

        // Sort by timestamp and limit
        allActivities.sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setActivities(allActivities.slice(0, 20));
      } catch {
        setActivities([]);
      } finally {
        setLoading(false);
      }
    }

    loadActivities();
  }, [agentId]);

  if (loading) {
    return (
      <div className="p-4 text-text-secondary text-sm">
        Loading activity...
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="p-4 text-text-secondary text-sm text-center">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="p-3 bg-board-bg rounded-lg"
        >
          <p className="text-sm text-text-primary line-clamp-3">
            {activity.content}
          </p>
          <p className="text-xs text-text-secondary mt-1">
            {new Date(activity.timestamp).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
