/**
 * useBackButton.js - Handle mobile back button within the app
 *
 * Uses a "guard entry" pattern: pushes an extra history entry so the browser
 * back button always triggers popstate instead of exiting the app.
 * On popstate, dismisses overlays or navigates to the previous view.
 */

import { useEffect, useRef } from 'react';
import { useUI } from '../contexts';
import { SCREEN } from '../constants/uiConstants';

export const useBackButton = () => {
  const {
    currentView, setCurrentScreen,
    isShowdownViewOpen, closeShowdownView,
    showCardSelector, closeCardSelector,
    contextMenu, setContextMenu,
    isSidebarCollapsed, toggleSidebar,
  } = useUI();

  // Use refs so the popstate handler always sees latest state
  // without needing to re-register the listener
  const stateRef = useRef({
    currentView, isShowdownViewOpen, showCardSelector, contextMenu, isSidebarCollapsed,
  });
  const viewHistoryRef = useRef([currentView]);
  const isNavigatingBackRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    stateRef.current = {
      currentView, isShowdownViewOpen, showCardSelector, contextMenu, isSidebarCollapsed,
    };
  });

  // Track forward navigation in a history stack
  useEffect(() => {
    if (isNavigatingBackRef.current) {
      isNavigatingBackRef.current = false;
      return;
    }
    const history = viewHistoryRef.current;
    if (history[history.length - 1] !== currentView) {
      history.push(currentView);
      // Keep bounded
      if (history.length > 30) history.shift();
    }
  }, [currentView]);

  // Set up guard entry and popstate listener (once on mount)
  useEffect(() => {
    // Push a guard entry so back button triggers popstate instead of exiting
    window.history.pushState({ pokerGuard: true }, '');

    const handlePopState = () => {
      // Re-push the guard immediately so the next back press also stays in-app
      window.history.pushState({ pokerGuard: true }, '');

      const {
        showCardSelector: cardOpen,
        isShowdownViewOpen: showdownOpen,
        contextMenu: menuOpen,
        isSidebarCollapsed: sidebarCollapsed,
      } = stateRef.current;
      const history = viewHistoryRef.current;

      // Dismiss in priority order (topmost overlay first)
      if (cardOpen) {
        closeCardSelector();
        return;
      }
      if (showdownOpen) {
        closeShowdownView();
        return;
      }
      if (menuOpen) {
        setContextMenu(null);
        return;
      }
      if (!sidebarCollapsed) {
        toggleSidebar();
        return;
      }

      // Navigate to previous view
      if (history.length > 1) {
        history.pop(); // Remove current view
        const previousView = history[history.length - 1];
        isNavigatingBackRef.current = true;
        setCurrentScreen(previousView);
      }
      // If at root (TABLE), do nothing — guard re-push prevents exit
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [closeCardSelector, closeShowdownView, setContextMenu, toggleSidebar, setCurrentScreen]);
};
