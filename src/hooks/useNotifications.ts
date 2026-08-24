import { useState, useEffect, useCallback } from 'react';

export interface Notification {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  read: boolean;
}

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const apiBase = import.meta.env.VITE_API_BASE_URL ?? `${window.location.protocol}//${window.location.hostname}:8000/api`;
    const root = String(apiBase).replace(/\/api\/?$/, '');
    const wsRoot = root.replace(/^http/, 'ws');
    const wsUrl = `${wsRoot}/ws/notifications/${userId}`;
    
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const newNotif: Notification = {
          id: Math.random().toString(36).substring(7),
          type: message.type,
          data: message.data,
          timestamp: Date.now(),
          read: false
        };
        
        setNotifications(prev => [newNotif, ...prev]);
        setUnreadCount(prev => prev + 1);
        
        // Optionally show browser notification if permitted
        if (Notification.permission === 'granted') {
          new Notification('تنبيه جديد', {
            body: 'لديك إشعار جديد في منصة بصيرة'
          });
        }
      } catch (e) {
        console.error('Failed to parse notification message', e);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      socket.close();
    };
  }, [userId]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead
  };
}
