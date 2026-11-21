import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { Menu, X, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminSidebar from './AdminSidebar';
import { useAuth } from '../../context/AuthContext';
import TourWrapper from '../tour/TourWrapper';

const POLL_INTERVAL = 15000; // 15 seconds

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [popups, setPopups] = useState([]);
  const { token, user } = useAuth();
  const navigate = useNavigate();

  // Track the last known notification ID to detect new ones
  const lastKnownIdRef = useRef(null);
  // Track processed notification IDs to prevent duplicate popups
  const processedNotifications = useRef(new Set());

  const API_URL = import.meta.env.VITE_API_URL;

  /**
   * Fetch unread count and check for new notifications.
   * If a new notification is detected, show a toast popup and play sound.
   */
  const pollNotifications = useCallback(async () => {
    if (!token || !user) return;
    if (user.role === 'mechanic') return; // Mechanics do not have access to notifications
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    try {
      // Single combined request returns both unread count and latest notification
      const countRes = await fetch(`${API_URL}/communications/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!countRes.ok) return;
      const countData = await countRes.json();
      if (!countData.success) return;

      const newCount = countData.count;
      let latestNotif = countData.latestNotification;

      // Fallback only if server did not include latestNotification
      if (latestNotif === undefined) {
        const notifRes = await fetch(`${API_URL}/communications/notifications?limit=1`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!notifRes.ok) return;
        const notifData = await notifRes.json();
        latestNotif = notifData.success && notifData.data?.length > 0 ? notifData.data[0] : null;
      }

      if (!latestNotif) {
        setUnreadCount(newCount);
        return;
      }

      const latestId = latestNotif._id;

      // On first poll, just record the latest ID without showing a popup
      if (lastKnownIdRef.current === null) {
        lastKnownIdRef.current = latestId;
        setUnreadCount(newCount);
        return;
      }

      // If we detect a new notification ID that we haven't processed
      if (latestId !== lastKnownIdRef.current && !processedNotifications.current.has(latestId)) {
        lastKnownIdRef.current = latestId;
        processedNotifications.current.add(latestId);

        // Show toast popup
        const newPopup = {
          id: latestId,
          title: latestNotif.title,
          message: latestNotif.message,
          relatedModel: latestNotif.relatedModel,
          relatedId: latestNotif.relatedId,
          type: latestNotif.type
        };

        setPopups((prev) => {
          const updated = [...prev, newPopup];
          return updated.slice(-5); // Keep max 5 visible
        });

        // Play notification sound
        const audio = new Audio('/sounds/notification.wav');
        audio.play().catch((err) => {
          console.warn('Audio playback prevented by browser autoplay policy:', err);
        });

        // Auto-dismiss after 8 seconds
        setTimeout(() => {
          setPopups((prev) => prev.filter((p) => p.id !== newPopup.id));
        }, 8000);
      }

      setUnreadCount(newCount);
    } catch (err) {
      // Silent fail — network issues shouldn't break the admin UI
    }
  }, [token, API_URL, user]);

  // Initial fetch + polling interval
  useEffect(() => {
    if (!token || !user || user.role === 'mechanic') return;

    pollNotifications(); // initial check
    const intervalId = setInterval(pollNotifications, POLL_INTERVAL);
    return () => clearInterval(intervalId);
  }, [pollNotifications, token, user]);

  const removePopup = (id) => {
    setPopups((prev) => prev.filter((p) => p.id !== id));
  };

  const handlePopupClick = (popup) => {
    if (popup.relatedModel === 'JobCard' && popup.relatedId) {
      navigate(`/admin/job-cards/${popup.relatedId}/edit`);
    } else if (popup.relatedModel === 'ServiceRequest' || popup.relatedModel === 'Booking' || popup.relatedModel === 'Quote' || popup.relatedModel === 'Contact') {
      navigate('/admin/communications');
    }
    removePopup(popup.id);
  };

  return (
    <TourWrapper>
      <div className="min-h-screen bg-gray-50 flex overflow-x-hidden relative">
        {/* Toast Notification Container */}
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
          <AnimatePresence>
            {popups.map((popup) => (
              <motion.div
                key={popup.id}
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                className="bg-white rounded-lg shadow-xl border border-gray-100 p-4 w-[320px] sm:w-[380px] pointer-events-auto relative overflow-hidden"
              >
                {/* Left Accent Border */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 text-primary">
                    <Bell size={16} className="animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider">{popup.title}</span>
                  </div>
                  <button onClick={() => removePopup(popup.id)} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={16} />
                  </button>
                </div>
                <p className="text-sm text-gray-700 leading-snug mb-3">
                  {popup.message}
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={() => handlePopupClick(popup)}
                    className="bg-primary text-white text-xs font-bold px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
                  >
                    View
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Sidebar Component */}
        <AdminSidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} unreadCount={unreadCount} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col lg:pl-[240px] min-w-0 w-full max-w-[100vw]">
          {/* Mobile Topbar */}
          <header className="lg:hidden flex items-center justify-between px-4 py-4 bg-white border-b border-gray-100 sticky top-0 z-30">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src="/Logo.png" alt="GSK Logo" className="w-12 h-12 object-contain" />
              <span className="text-dark font-heading text-xl">GSK</span>
            </Link>
            <button 
              onClick={() => setSidebarOpen(true)}
              className="text-gray-500 hover:text-dark"
            >
              <Menu size={24} />
            </button>
          </header>

          {/* Page Content — isolated Suspense boundary keeps Sidebar mounted during lazy route loads */}
          <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden">
            <React.Suspense
              fallback={
                <div className="h-[60vh] w-full flex items-center justify-center">
                  <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              }
            >
              <Outlet />
            </React.Suspense>
          </main>
        </div>
      </div>
    </TourWrapper>
  );
};

export default AdminLayout;
