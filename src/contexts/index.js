/**
 * Contexts index - Exports all context providers and hooks
 * Central import point for context API
 */

export { AuthProvider, useAuth } from './AuthContext';
export { GameProvider, useGame } from './GameContext';
export { UIProvider, useUI } from './UIContext';
export { SessionProvider, useSession } from './SessionContext';
export { PlayerProvider, usePlayer } from './PlayerContext';
export { CardProvider, useCard } from './CardContext';
export { SettingsProvider, useSettings } from './SettingsContext';
export { ToastProvider, useToast } from './ToastContext';
export { TendencyProvider, useTendency, useSeatTendency } from './TendencyContext';
export { TournamentProvider, useTournament } from './TournamentContext';
export { SyncBridgeProvider, useSyncBridge } from './SyncBridgeContext';
export { OnlineSessionProvider, useOnlineSession } from './OnlineSessionContext';
// AUDIT-2026-04-21-TV F11: `useAnalysisContext` is the canonical name.
// `useOnlineAnalysisContext` is retained as a deprecated alias in the source module.
export { OnlineAnalysisProvider, useAnalysisContext, useOnlineAnalysisContext } from './OnlineAnalysisContext';
export { EquityWorkerProvider, useEquityWorker } from './EquityWorkerContext';
export { TournamentBridge } from './TournamentBridge';
// MPMF G5-B1 (2026-04-25) — entitlement state for monetization & PMF.
export { EntitlementProvider, useEntitlement } from './EntitlementContext';
// PRF Phase 5 (2026-04-26, PRF-G5-HK) — printable refresher state.
export { RefresherProvider, useRefresher } from './RefresherContext';
