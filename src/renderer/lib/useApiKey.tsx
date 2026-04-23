import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import ApiKeyModal from '../components/ApiKeyModal'
import { api } from './api'

type ApiKeyContextValue = {
  hasKey: boolean
  loading: boolean
  promptForKey: (onSaved?: () => void) => void
  refresh: () => Promise<void>
}

const ApiKeyContext = createContext<ApiKeyContextValue | null>(null)

export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const [hasKey, setHasKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingCallback, setPendingCallback] = useState<
    (() => void) | null
  >(null)

  const refresh = useCallback(async () => {
    try {
      const s = await api.settings.get()
      setHasKey(!!s.openRouterApiKey)
    } catch {
      setHasKey(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const promptForKey = useCallback((onSaved?: () => void) => {
    setPendingCallback(() => onSaved ?? null)
    setModalOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    setModalOpen(false)
    setPendingCallback(null)
  }, [])

  const handleSaved = useCallback(() => {
    setHasKey(true)
    if (pendingCallback) {
      const cb = pendingCallback
      setPendingCallback(null)
      // Delay so the modal's "AI enabled!" confirmation is visible briefly
      setTimeout(() => cb(), 950)
    }
  }, [pendingCallback])

  const value = useMemo(
    () => ({ hasKey, loading, promptForKey, refresh }),
    [hasKey, loading, promptForKey, refresh],
  )

  return (
    <ApiKeyContext.Provider value={value}>
      {children}
      {modalOpen && (
        <ApiKeyModal onClose={handleClose} onSaved={handleSaved} />
      )}
    </ApiKeyContext.Provider>
  )
}

export function useApiKey(): ApiKeyContextValue {
  const ctx = useContext(ApiKeyContext)
  if (!ctx) {
    throw new Error('useApiKey must be used within ApiKeyProvider')
  }
  return ctx
}
