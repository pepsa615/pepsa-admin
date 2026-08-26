import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../core/api.js';
import { formatDate } from '../core/format.js';
import { useAsync } from '../core/useAsync.js';

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const notifications = useAsync(() => api.notifications(), []);
  useEffect(() => {
    const timer = window.setInterval(() => void notifications.reload(), 30_000);
    return () => window.clearInterval(timer);
  }, [notifications.reload]);
  const items = Array.isArray(notifications.data) ? notifications.data : [];
  const unread = items.filter(({ status }) => status === 'UNREAD').length;
  return (
    <div className="notification-menu">
      <button
        className="icon-control"
        aria-label={`${unread} unread notifications`}
        onClick={() => setOpen((value) => !value)}
      >
        ◌{unread > 0 && <b>{unread}</b>}
      </button>
      {open && (
        <div className="notification-popover">
          <header>
            <strong>Notifications</strong>
            {unread > 0 && (
              <button
                className="text-link"
                onClick={() => void api.readAllNotifications().then(notifications.reload)}
              >
                Mark all read
              </button>
            )}
          </header>
          {!items.length ? (
            <p>No notifications.</p>
          ) : (
            items.slice(0, 8).map((item) => (
              <Link
                key={item.id}
                className={item.status === 'UNREAD' ? 'unread' : ''}
                to={item.href ?? '#'}
                onClick={() => void api.readNotification(item.id).then(notifications.reload)}
              >
                <strong>{item.title}</strong>
                <span>{item.message}</span>
                <small>{formatDate(item.createdAt)}</small>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
