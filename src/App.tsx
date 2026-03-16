import { useState, useRef, useEffect, useCallback, useId } from 'react'
import {
  Delete, ArrowRight, CircleCheck, CircleStop, X,
  Clock, User, Pencil, Square, Play, Sun, Moon, BedDouble,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TimeEntry {
  clockIn: Date
  clockOut: Date
  role: string
}

interface Employee {
  id: number
  name: string
  kioskId: string
  job: string
  roles?: string[]
  clockedIn: boolean
  clockInTime: Date | null
  recentEntries?: TimeEntry[]
}

type Screen = 'pin' | 'employee' | 'roleSelect' | 'confirm'
type ConfirmType = 'in' | 'out'
type RoleSelectMode = 'clockIn' | 'changeRole'

interface Toast {
  role: string
  clockInTime: Date
  exiting: boolean
}

// ── Mock Data ──────────────────────────────────────────────────────────────────

function daysAgo(d: number, h: number, m: number) {
  const t = new Date(); t.setDate(t.getDate() - d); t.setHours(h, m, 0, 0); return t
}

const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 1, name: 'Alex Johnson', kioskId: '1234', job: 'Barista',
    roles: ['Barista', 'Chef', 'Server', 'Dishwasher'], clockedIn: false, clockInTime: null,
    recentEntries: [
      { clockIn: daysAgo(0, 7, 0),  clockOut: daysAgo(0, 10, 30), role: 'Barista' },
      { clockIn: daysAgo(0, 11, 0), clockOut: daysAgo(0, 14, 30), role: 'Chef' },
    ],
  },
  {
    id: 2, name: 'Sam Williams', kioskId: '5678', job: 'Server',
    roles: ['Server', 'Host', 'Barista'], clockedIn: true, clockInTime: new Date(Date.now() - 92 * 60 * 1000),
    recentEntries: [
      { clockIn: daysAgo(1, 10, 0), clockOut: daysAgo(1, 15, 30), role: 'Host' },
    ],
  },
  { id: 3, name: 'Jordan Davis', kioskId: '9012', job: 'Host', clockedIn: false, clockInTime: null },
]

const COMPANY_NAME = 'Boston Tea Company'
const PIN_LENGTH = 4
const TIMEOUT_SECONDS = 60
const CONFIRM_SECONDS = 3

// ── Design tokens ──────────────────────────────────────────────────────────────

const T = {
  bg: 'var(--t-bg)',
  white: 'var(--t-white)',
  purple: 'var(--t-purple)',
  purpleDim: 'var(--t-purple-dim)',
  green: 'var(--t-green)',
  orange: 'var(--t-orange)',
  textPrimary: 'var(--t-text-primary)',
  textSecondary: 'var(--t-text-secondary)',
  textSubdued: 'var(--t-text-subdued)',
  border: 'var(--t-border)',
  borderSubdued: 'var(--t-border-subdued)',
  error: 'var(--t-error)',
  shadow: 'var(--t-shadow)',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getGreeting(date: Date) {
  const h = date.getHours()
  if (h < 12) return 'Good Morning!'
  if (h < 17) return 'Good Afternoon!'
  return 'Good Evening!'
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  })
}

function formatTimeShort(date: Date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatElapsed(from: Date, to: Date) {
  const diff = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000))
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}


// ── Icons ──────────────────────────────────────────────────────────────────────

function BackspaceIcon() {
  return <Delete style={{ width: '100%', height: '100%' }} />
}

function ArrowRightIcon() {
  return <ArrowRight style={{ width: '100%', height: '100%' }} />
}

function CheckCircleIcon() {
  return (
    <div style={{
      width: 80, height: 80, borderRadius: '50%', backgroundColor: T.purpleDim,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: '50%', backgroundColor: T.purple,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <CircleCheck size={32} color="white" strokeWidth={2} />
      </div>
    </div>
  )
}

function ClockOutConfirmIcon() {
  return (
    <div style={{
      width: 80, height: 80, borderRadius: '50%', backgroundColor: 'rgba(249,98,38,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: '50%', backgroundColor: T.orange,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <CircleStop size={32} color="white" strokeWidth={2} />
      </div>
    </div>
  )
}

function ClockIcon() {
  return <Clock size={20} color={T.textSubdued} strokeWidth={1.5} />
}

function RoleIcon() {
  return <User size={20} color={T.textPrimary} strokeWidth={1.5} />
}

function EditIcon() {
  return <Pencil size={16} color={T.textSubdued} strokeWidth={1.5} />
}

function StopIcon() {
  return <Square size={16} color="white" fill="white" strokeWidth={0} />
}

function PlayIcon() {
  return <Play size={16} fill="currentColor" strokeWidth={0} />
}

function SunIcon() {
  return <Sun size={20} strokeWidth={1.5} />
}

function MoonIcon() {
  return <Moon size={20} strokeWidth={1.5} />
}


// ── Keypad Button ──────────────────────────────────────────────────────────────

function formatEntryDuration(from: Date, to: Date) {
  const mins = Math.round((to.getTime() - from.getTime()) / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ── Recent Activity ────────────────────────────────────────────────────────────

function RecentActivity({ entries, roles, onEditRole }: {
  entries: TimeEntry[]
  roles?: string[]
  onEditRole?: (index: number, role: string) => void
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [pendingRole, setPendingRole] = useState<string | null>(null)
  const modalTitleId = useId()
  const modalRef = useRef<HTMLDivElement>(null)

  // Move focus into modal when it opens
  useEffect(() => {
    if (editingIndex !== null) {
      modalRef.current?.focus()
    }
  }, [editingIndex])

  // Trap focus inside modal
  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { handleCancel(); return }
    if (e.key !== 'Tab') return
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable || focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus()
    }
  }

  const openModal = (i: number, currentRole: string) => {
    setEditingIndex(i)
    setPendingRole(currentRole)
  }

  const handleSave = () => {
    if (editingIndex !== null && pendingRole !== null) {
      onEditRole?.(editingIndex, pendingRole)
    }
    setEditingIndex(null)
    setPendingRole(null)
  }

  const handleCancel = () => {
    setEditingIndex(null)
    setPendingRole(null)
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 20, fontWeight: 600, color: T.textPrimary, lineHeight: 1 }}>
        Recent Activity
      </p>
      <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 2 }}>
        {entries.map((entry, i) => (
          <div key={i} style={{ backgroundColor: T.white, borderRadius: 16, overflow: 'hidden', paddingLeft: 12 }}>
            {/* Time range row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16, height: 48,
              paddingRight: 12, borderBottom: `1px solid ${T.borderSubdued}`,
            }}>
              <ClockIcon />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.textSubdued }}>
                {formatTimeShort(entry.clockIn)} – {formatTimeShort(entry.clockOut)}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.textSubdued }}>
                {formatEntryDuration(entry.clockIn, entry.clockOut)}
              </span>
            </div>
            {/* Role row */}
            <button
              onClick={() => roles && roles.length > 1 && openModal(i, entry.role)}
              aria-label={roles && roles.length > 1 ? `Edit role: ${entry.role}` : undefined}
              aria-haspopup={roles && roles.length > 1 ? 'dialog' : undefined}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                minHeight: 56, paddingRight: 12, paddingTop: 12, paddingBottom: 12,
                border: 'none', backgroundColor: 'transparent',
                cursor: roles && roles.length > 1 ? 'pointer' : 'default', textAlign: 'left',
              }}
            >
              <RoleIcon />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.textPrimary }}>Role</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: T.textPrimary, textTransform: 'capitalize' }}>
                  {entry.role}
                </span>
                {roles && roles.length > 1 && <EditIcon />}
              </div>
            </button>
          </div>
        ))}
      </div>

      {/* Role edit modal */}
      {editingIndex !== null && roles && (
        <div
          onPointerDown={handleCancel}
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            tabIndex={-1}
            onPointerDown={e => e.stopPropagation()}
            onKeyDown={handleModalKeyDown}
            style={{
              backgroundColor: T.bg, borderRadius: 20, padding: 24,
              width: '100%', maxWidth: 400,
              boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
              display: 'flex', flexDirection: 'column', gap: 16,
              outline: 'none',
            }}
          >
            <p id={modalTitleId} style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary }}>Edit Role</p>

            <div style={{ backgroundColor: T.white, borderRadius: 14, overflow: 'hidden' }}>
              {roles.map(role => {
                const isSelected = pendingRole === role
                return (
                  <button
                    key={role}
                    onClick={() => setPendingRole(role)}
                    aria-pressed={isSelected}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                      padding: '16px 16px',
                      border: 'none', borderBottom: `1px solid ${T.borderSubdued}`,
                      backgroundColor: isSelected ? 'var(--t-selected-bg)' : 'transparent',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{ flex: 1, fontSize: 16, fontWeight: 500, color: T.textPrimary }}>
                      {role}
                    </span>
                    {isSelected && <CircleCheck size={18} color={T.purple} strokeWidth={2.5} aria-hidden="true" />}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleCancel}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: 9999,
                  border: `1px solid ${T.border}`, backgroundColor: T.white,
                  fontSize: 16, fontWeight: 600, color: T.textPrimary, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: 9999,
                  border: 'none', backgroundColor: T.purple,
                  fontSize: 16, fontWeight: 600, color: '#ffffff', cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KeypadBtn({
  children, onClick, disabled = false, variant = 'default', ariaLabel,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'submit'
  ariaLabel?: string
}) {
  const [pressed, setPressed] = useState(false)

  const style: React.CSSProperties = variant === 'submit'
    ? { backgroundColor: pressed && !disabled ? 'var(--t-purple-pressed)' : T.purple, color: T.white }
    : { backgroundColor: pressed ? 'var(--t-btn-pressed)' : T.white, border: `1px solid ${T.border}`, color: T.textPrimary }

  return (
    <button
      className="keypad-btn"
      style={{ ...style, opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => !disabled && setPressed(true)}
      onTouchEnd={() => setPressed(false)}
    >
      <span aria-hidden="true" style={{ display: 'flex', width: 'calc(var(--btn-size) * 0.25)', height: 'calc(var(--btn-size) * 0.25)', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </span>
    </button>
  )
}

// ── App ────────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<Screen>('pin')
  const [digits, setDigits] = useState<string[]>([])
  const [error, setError] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [roleSelectMode, setRoleSelectMode] = useState<RoleSelectMode>('clockIn')
  const [confirmType, setConfirmType] = useState<ConfirmType | null>(null)
  const [confirmTime, setConfirmTime] = useState<Date | null>(null)
  const [now, setNow] = useState(new Date())
  const [timeoutRemaining, setTimeoutRemaining] = useState(TIMEOUT_SECONDS)
  const [confirmCountdown, setConfirmCountdown] = useState(CONFIRM_SECONDS)
  const [toast, setToast] = useState<Toast | null>(null)
  const [darkMode, setDarkMode] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [showScreensaver, setShowScreensaver] = useState(false)
  const [wakingUp, setWakingUp] = useState(false)
  const wakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const employeeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const confirmTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const screensaverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const screenHeadingRef = useRef<HTMLHeadingElement>(null)

  // Move focus to screen heading on screen changes
  useEffect(() => {
    screenHeadingRef.current?.focus()
  }, [screen])

  // Reset screensaver timer on any pin screen activity
  useEffect(() => {
    if (screen !== 'pin') {
      setShowScreensaver(false)
      if (screensaverTimerRef.current) clearTimeout(screensaverTimerRef.current)
      return
    }
    if (screensaverTimerRef.current) clearTimeout(screensaverTimerRef.current)
    screensaverTimerRef.current = setTimeout(() => setShowScreensaver(true), 30_000)
    return () => { if (screensaverTimerRef.current) clearTimeout(screensaverTimerRef.current) }
  }, [screen, digits, error])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const resetToPin = useCallback(() => {
    setScreen('pin')
    setDigits([])
    setError(false)
    setEmployee(null)
    setSelectedRole(null)
    setConfirmType(null)
    if (employeeTimerRef.current) clearInterval(employeeTimerRef.current)
    if (confirmTimerRef.current) clearInterval(confirmTimerRef.current)
  }, [])

  useEffect(() => {
    if (screen !== 'employee' && screen !== 'roleSelect') return
    setTimeoutRemaining(TIMEOUT_SECONDS)
    const id = setInterval(() => {
      setTimeoutRemaining(prev => {
        if (prev <= 1) { resetToPin(); return 0 }
        return prev - 1
      })
    }, 1000)
    employeeTimerRef.current = id
    return () => clearInterval(id)
  }, [screen, resetToPin])

  useEffect(() => {
    if (screen !== 'confirm') return
    setConfirmCountdown(CONFIRM_SECONDS)
    const id = setInterval(() => {
      setConfirmCountdown(prev => {
        if (prev <= 1) { resetToPin(); return 0 }
        return prev - 1
      })
    }, 1000)
    confirmTimerRef.current = id
    return () => clearInterval(id)
  }, [screen, resetToPin])

  const handleDigit = useCallback((d: string) => {
    setError(false)
    setDigits(prev => {
      if (prev.length >= PIN_LENGTH) return prev
      return [...prev, d]
    })
  }, [])

  const handleBackspace = useCallback(() => {
    setError(false)
    setDigits(prev => prev.slice(0, -1))
  }, [])

  const handleSubmit = useCallback(() => {
    const pin = digits.join('')
    const found = employees.find(e => e.kioskId === pin)
    if (!found) {
      setError(true)
      setShaking(true)
      setTimeout(() => {
        setShaking(false)
        setDigits([])
      }, 400)
      return
    }
    setEmployee(found)
    if (!found.clockedIn && found.roles && found.roles.length > 1) {
      setSelectedRole(found.roles[0])
      setRoleSelectMode('clockIn')
      setScreen('roleSelect')
    } else {
      setScreen('employee')
    }
  }, [digits, employees])

  // Auto-submit when PIN is complete
  useEffect(() => {
    if (digits.length === PIN_LENGTH) handleSubmit()
  }, [digits])

  // Physical keyboard / numpad support on PIN screen
  useEffect(() => {
    if (screen !== 'pin' || showScreensaver) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') { handleDigit(e.key); return }
      if (e.key === 'Backspace' || e.key === 'Delete') { handleBackspace(); return }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [screen, showScreensaver, digits, handleDigit, handleBackspace, handleSubmit])

  const handleClockIn = useCallback((role?: string) => {
    if (!employee) return
    const jobForShift = role ?? selectedRole ?? employee.job
    const updated = { ...employee, job: jobForShift, clockedIn: true, clockInTime: new Date() }
    setEmployees(prev => prev.map(e => e.id === employee.id ? updated : e))
    setEmployee(updated)
    setConfirmType('in')
    setConfirmTime(new Date())
    setScreen('confirm')
  }, [employee, selectedRole])

  const handleClockOut = useCallback(() => {
    if (!employee) return
    const updated = { ...employee, clockedIn: false, clockInTime: null }
    setEmployees(prev => prev.map(e => e.id === employee.id ? updated : e))
    setEmployee(updated)
    setConfirmType('out')
    setConfirmTime(new Date())
    setScreen('confirm')
  }, [employee])

  const handleEditRole = useCallback(() => {
    if (!employee) return
    setSelectedRole(employee.job)
    setRoleSelectMode('changeRole')
    setScreen('roleSelect')
  }, [employee])

  const handleEditEntryRole = useCallback((index: number, role: string) => {
    if (!employee?.recentEntries) return
    const updatedEntries = employee.recentEntries.map((e, i) => i === index ? { ...e, role } : e)
    const updated = { ...employee, recentEntries: updatedEntries }
    setEmployees(prev => prev.map(e => e.id === employee.id ? updated : e))
    setEmployee(updated)
  }, [employee])

  const handleSaveRole = useCallback((role: string) => {
    if (!employee) return
    const updated = { ...employee, job: role }
    setEmployees(prev => prev.map(e => e.id === employee.id ? updated : e))
    setEmployee(updated)
    setScreen('employee')
    // Show toast
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ role, clockInTime: employee.clockInTime ?? new Date(), exiting: false })
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => prev ? { ...prev, exiting: true } : null)
      setTimeout(() => setToast(null), 250)
    }, 3000)
  }, [employee])

  // Shared pill button style helper
  const pillBtn = (bg: string, color: string, border?: string): React.CSSProperties => ({
    width: '100%',
    padding: 'clamp(16px, 2.5vw, 22px) 24px',
    borderRadius: 9999,
    border: border ?? 'none',
    backgroundColor: bg,
    color,
    fontSize: 'var(--role-font)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  })

  return (
    <div style={{ minHeight: '100vh', width: '100%', backgroundColor: T.bg, display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <header className="kiosk-header">
        <span className="kiosk-header-company" style={{ color: T.textPrimary }}>{COMPANY_NAME}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="kiosk-header-time">
            <span className="date-label" style={{ color: T.textPrimary }}>{formatDate(now)}</span>
            <span style={{ color: T.textPrimary, minWidth: '7ch', textAlign: 'right' }}>{formatTime(now)}</span>
          </div>
          <button
            onClick={() => setDarkMode(d => !d)}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: `1px solid ${T.border}`,
              backgroundColor: T.white, color: T.textSubdued,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
            aria-label="Toggle dark mode"
          >
            {darkMode ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            onClick={() => setShowScreensaver(true)}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: `1px solid ${T.border}`,
              backgroundColor: T.white, color: T.textSubdued,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
            aria-label="Sleep"
          >
            <BedDouble size={18} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `16px 16px ${screen === 'employee' || screen === 'roleSelect' ? '160px' : '80px'}` }}>

        {/* ── PIN Entry ── */}
        {wakingUp && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
        )}

        {screen === 'pin' && (
          <div className="kiosk-container">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <h1
                ref={screenHeadingRef}
                tabIndex={-1}
                style={{ fontSize: 'var(--greeting-font)', fontWeight: 700, color: T.textPrimary, textAlign: 'center', lineHeight: 1.1, outline: 'none' }}
              >
                {getGreeting(now)}
              </h1>
              <p style={{ fontSize: 'var(--body-font)', color: T.textSecondary, textAlign: 'center', lineHeight: 1.4 }}>
                Enter your Kiosk ID to continue
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              {/* Screen-reader PIN status */}
              <div
                aria-live="polite"
                aria-atomic="true"
                style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
              >
                {error
                  ? 'Invalid Kiosk ID. Please try again.'
                  : digits.length === 0
                    ? 'Kiosk ID entry. No digits entered.'
                    : `${digits.length} of ${PIN_LENGTH} digits entered.`}
              </div>
              <div className={`pin-row${shaking ? ' pin-shake' : ''}`} aria-hidden="true">
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <div key={i} className="pin-box" style={{
                    border: `2px solid ${error ? T.error : i < digits.length ? T.purple : T.border}`,
                    backgroundColor: T.white, boxShadow: T.shadow,
                  }}>
                    {i < digits.length && <div className="pin-dot" style={{ backgroundColor: T.textPrimary }} />}
                  </div>
                ))}
              </div>
              {error && (
                <p role="alert" style={{ fontSize: 14, color: T.error, fontWeight: 500 }}>
                  Invalid Kiosk ID. Please try again.
                </p>
              )}
            </div>

            <div className="keypad-grid" role="group" aria-label="Kiosk ID keypad">
              {['1','2','3','4','5','6','7','8','9'].map(d => (
                <KeypadBtn key={d} onClick={() => handleDigit(d)}>{d}</KeypadBtn>
              ))}
              <KeypadBtn onClick={handleBackspace} disabled={digits.length === 0} ariaLabel="Delete last digit"><BackspaceIcon /></KeypadBtn>
              <KeypadBtn onClick={() => handleDigit('0')}>0</KeypadBtn>
              <KeypadBtn onClick={() => { setError(false); setDigits([]) }} disabled={digits.length === 0} ariaLabel="Clear PIN"><X style={{ width: '100%', height: '100%' }} /></KeypadBtn>
            </div>

            <p style={{ fontSize: 13, color: T.textSecondary, opacity: 0.6, textAlign: 'center' }}>
              Demo Kiosk IDs: 1234 · 5678 · 9012
            </p>
          </div>
        )}

        {/* ── Role Select ── */}
        {screen === 'roleSelect' && employee && employee.roles && (
          <div className="kiosk-container">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
              <h1 ref={screenHeadingRef} tabIndex={-1} style={{ fontSize: 'var(--greeting-font)', fontWeight: 700, color: T.textPrimary, textAlign: 'center', outline: 'none' }}>
                {employee.name}
              </h1>
              <p style={{ fontSize: 'var(--body-font)', color: T.textSecondary, textAlign: 'center' }}>
                {roleSelectMode === 'changeRole' ? 'Select your role for this shift.' : 'Choose your role and clock in to start your shift.'}
              </p>
            </div>

            <div style={{ backgroundColor: T.white, borderRadius: 16, padding: 16, width: '100%', boxShadow: T.shadow }}>
              {employee.roles.map(role => {
                const isSelected = selectedRole === role
                return (
                  <button key={role} onClick={() => setSelectedRole(role)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                    padding: 'clamp(14px, 2.5vw, 20px) 12px',
                    borderRadius: 12, border: 'none', cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--t-selected-bg)' : 'transparent',
                    textAlign: 'left', transition: 'background-color 0.12s',
                  }}>
                    <span style={{ flex: 1, fontSize: 'var(--role-font)', fontWeight: 500, color: T.textPrimary }}>
                      {role}
                    </span>
                    {isSelected && (
                      <CircleCheck size={18} color={T.purple} strokeWidth={2.5} />
                    )}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
              {roleSelectMode === 'changeRole' ? (
                <button
                  onClick={() => selectedRole && handleSaveRole(selectedRole)}
                  disabled={!selectedRole}
                  style={{ ...pillBtn(T.purple, T.white), opacity: selectedRole ? 1 : 0.5 }}
                >
                  Save Role
                </button>
              ) : (
                <button
                  onClick={() => handleClockIn(selectedRole ?? undefined)}
                  disabled={!selectedRole}
                  style={{ ...pillBtn(T.purple, T.white), opacity: selectedRole ? 1 : 0.5 }}
                >
                  <PlayIcon /> Clock In
                </button>
              )}
            </div>

            {roleSelectMode === 'clockIn' && employee.recentEntries && employee.recentEntries.length > 0 && (
              <RecentActivity entries={employee.recentEntries} roles={employee.roles} onEditRole={handleEditEntryRole} />
            )}
          </div>
        )}

        {/* ── Employee Screen ── */}
        {screen === 'employee' && employee && (
          <div className={employee.recentEntries?.length ? 'employee-split' : 'kiosk-container'}>

            {/* Left / main column */}
            <div className={employee.recentEntries?.length ? 'employee-split-main' : undefined}
              style={!employee.recentEntries?.length ? { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--screen-gap)', width: '100%' } : undefined}
            >
              {/* Name + status */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}>
                <h1 ref={screenHeadingRef} tabIndex={-1} style={{ fontSize: 30, fontWeight: 700, color: T.textPrimary, textAlign: 'center', letterSpacing: '0.01em', outline: 'none' }}>
                  {employee.name}
                </h1>
                {employee.clockedIn ? (
                  <p style={{ fontSize: 'var(--body-font)', color: T.green, textAlign: 'center' }}>
                    You're clocked in!
                  </p>
                ) : (
                  <p style={{ fontSize: 'var(--body-font)', color: T.textSecondary, textAlign: 'center' }}>
                    You're not clocked in yet.
                  </p>
                )}
              </div>

              {employee.clockedIn ? (
                <>
                  {/* Elapsed timer */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{
                      fontSize: 'clamp(40px, 8vw, 60px)', fontWeight: 700,
                      color: T.green, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '-0.02em',
                    }}>
                      {employee.clockInTime ? formatElapsed(employee.clockInTime, now) : '00:00:00'}
                    </span>
                    <span style={{ fontSize: 16, color: T.textPrimary }}>Time on Shift</span>
                  </div>

                  {/* Info card */}
                  <div style={{ backgroundColor: T.white, borderRadius: 16, width: '100%', overflow: 'hidden' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      padding: '14px 12px', borderBottom: `1px solid ${T.borderSubdued}`,
                    }}>
                      <ClockIcon />
                      <span style={{ fontSize: 14, fontWeight: 600, color: T.textSubdued }}>
                        Clocked in @ {employee.clockInTime ? formatTimeShort(employee.clockInTime) : ''}
                      </span>
                    </div>
                    {employee.roles && employee.roles.length > 1 && (
                      <button
                        onClick={handleEditRole}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                          padding: '14px 12px', border: 'none', backgroundColor: 'transparent',
                          cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <RoleIcon />
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.textPrimary }}>Role</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: T.textPrimary, textTransform: 'capitalize' }}>
                            {employee.job}
                          </span>
                          <EditIcon />
                        </div>
                      </button>
                    )}
                  </div>

                  <button onClick={handleClockOut} style={pillBtn(T.orange, T.white)}>
                    <StopIcon /> Clock Out
                  </button>
                </>
              ) : (
                <>
                  {/* Not clocked in state */}
                  <div style={{
                    backgroundColor: T.white, borderRadius: 16, padding: 'clamp(16px, 3vw, 24px) clamp(20px, 4vw, 32px)',
                    width: '100%', boxShadow: T.shadow, border: `1px solid ${T.border}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center',
                  }}>
                    <p style={{ fontSize: 13, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Current time</p>
                    <p style={{ fontSize: 'clamp(20px, 3.5vw, 26px)', fontWeight: 700, color: T.textPrimary }}>{formatTime(now)}</p>
                  </div>

                  <button onClick={() => handleClockIn()} style={pillBtn(T.purple, T.white)}>
                    <PlayIcon /> Clock In
                  </button>
                </>
              )}
            </div>

            {/* Right column — recent activity */}
            {employee.recentEntries && employee.recentEntries.length > 0 && (
              <div className="employee-split-activity">
                <RecentActivity entries={employee.recentEntries} roles={employee.roles} onEditRole={handleEditEntryRole} />
              </div>
            )}

          </div>
        )}

        {/* ── Confirmation ── */}
        {screen === 'confirm' && employee && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, width: 'var(--panel-w)', textAlign: 'center' }}>
            {confirmType === 'in' ? <CheckCircleIcon /> : <ClockOutConfirmIcon />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 'var(--body-font)', color: T.textSecondary }}>{employee.name}</p>
              <h1 ref={screenHeadingRef} tabIndex={-1} style={{ fontSize: 'var(--confirm-font)', fontWeight: 700, color: T.textPrimary, lineHeight: 1.1, outline: 'none' }}>
                {confirmType === 'in' ? 'Clocked In' : 'Clocked Out'} as {employee.job}!
              </h1>
              <p style={{ fontSize: 18, color: T.textSecondary }}>{confirmTime ? formatTime(confirmTime) : ''}</p>
            </div>
            <p aria-live="polite" aria-atomic="true" style={{ fontSize: 14, color: T.textSecondary, opacity: 0.7 }}>
              Returning in {confirmCountdown}s…
            </p>
          </div>
        )}

      </main>

      {/* ── Fixed bottom bar (employee + roleSelect screens) ── */}
      {(screen === 'employee' || screen === 'roleSelect') && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '16px 24px 32px', backgroundColor: 'var(--t-bar-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          borderTop: `1px solid ${T.border}`,
          gap: 12,
        }}>
          <div style={{ width: '100%', maxWidth: 'var(--container-w)' }}>
            <button
              onClick={
                screen === 'roleSelect' && roleSelectMode === 'changeRole'
                  ? () => setScreen('employee')
                  : resetToPin
              }
              style={pillBtn(T.white, T.textPrimary, `1px solid ${T.border}`)}
            >
              {screen === 'roleSelect' && roleSelectMode === 'changeRole' ? 'Cancel' : 'Return to PIN screen'}
            </button>
          </div>
          <div style={{ width: '100%', maxWidth: 'var(--container-w)', display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>
            {/* Announce timeout warning to screen readers at 10s */}
            <div
              aria-live="assertive"
              aria-atomic="true"
              style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
            >
              {timeoutRemaining === 10 ? 'Returning to PIN screen in 10 seconds.' : ''}
            </div>
            <p style={{ fontSize: 12, color: T.textSecondary }} aria-hidden="true">
              Returning in {timeoutRemaining}s
            </p>
            <div
              role="progressbar"
              aria-label="Session timeout"
              aria-valuenow={timeoutRemaining}
              aria-valuemin={0}
              aria-valuemax={TIMEOUT_SECONDS}
              style={{ width: '100%', height: 3, backgroundColor: T.border, borderRadius: 2 }}
            >
              <div style={{
                height: '100%', borderRadius: 2, backgroundColor: T.purple,
                width: `${(timeoutRemaining / TIMEOUT_SECONDS) * 100}%`,
                transition: 'width 1s linear',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div
          className={toast.exiting ? 'toast-exit' : 'toast-enter'}
          style={{
            position: 'fixed', bottom: 32, left: '50%',
            zIndex: 100, pointerEvents: 'none',
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            backgroundColor: T.white, borderRadius: 9999,
            padding: '18px 26px 18px 18px',
            boxShadow: '0px 4px 12px 0px rgba(0,0,0,0.10), 0px 2px 0px 0px rgba(25,16,22,0.04)',
            whiteSpace: 'nowrap',
          }}>
            {/* Green checkmark circle */}
            <div style={{
              width: 40, height: 40, borderRadius: '50%', backgroundColor: T.green, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CircleCheck size={20} color="white" strokeWidth={2} />
            </div>
            {/* Text */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 20, fontWeight: 600, color: T.textPrimary, lineHeight: 1 }}>
                Role updated to {toast.role}
              </span>
              <span style={{ fontSize: 16, fontWeight: 500, color: T.textSubdued, letterSpacing: '0.01em' }}>
                Shift started at {formatTimeShort(toast.clockInTime)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Screensaver ── */}
      {showScreensaver && (
        <div
          onPointerDown={(e) => {
            e.preventDefault()
            setShowScreensaver(false)
            setWakingUp(true)
            if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current)
            wakeTimerRef.current = setTimeout(() => setWakingUp(false), 400)
          }}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            backgroundColor: '#0c0a09',
            overflow: 'hidden', cursor: 'pointer',
          }}
        >
          {/* Animated background blobs */}
          <div className="ss-blob ss-blob-1" />
          <div className="ss-blob ss-blob-2" />
          <div className="ss-blob ss-blob-3" />

          {/* Drifting time display */}
          <div className="ss-content">
            <div style={{
              fontSize: 'clamp(52px, 14vw, 100px)', fontWeight: 700, lineHeight: 1,
              color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
            }}>
              {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
            </div>
            <div style={{
              marginTop: 12, fontSize: 'clamp(16px, 2.5vw, 22px)', fontWeight: 400,
              color: 'rgba(255,255,255,0.45)', letterSpacing: '0.04em',
            }}>
              {formatDate(now)}
            </div>
          </div>

          {/* Company name */}
          <div style={{
            position: 'absolute', top: 32, left: 0, right: 0,
            textAlign: 'center', pointerEvents: 'none',
            fontSize: 'var(--header-company-font)', fontWeight: 600,
            color: 'rgba(255,255,255,0.7)', letterSpacing: '-0.01em',
          }}>
            {COMPANY_NAME}
          </div>

          {/* Fixed bottom label */}
          <div style={{
            position: 'absolute', bottom: '10%', left: 0, right: 0,
            textAlign: 'center', pointerEvents: 'none',
            fontSize: 18, fontWeight: 400,
            color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            Tap to continue
          </div>
        </div>
      )}

    </div>
  )
}
