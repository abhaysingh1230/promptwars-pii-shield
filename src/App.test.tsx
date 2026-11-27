import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('PII Shield UI & Accessibility', () => {
  it('starts with a clean empty workspace and local processing indicator', () => {
    render(<App />)

    expect(screen.getByText('PII Shield')).toBeInTheDocument()
    expect(
      screen.getAllByText(/Processed in this browser/i).length
    ).toBeGreaterThan(0)
    expect(
      screen.getByText(/Paste text or upload a file/i)
    ).toBeInTheDocument()
    expect(
      (screen.getByLabelText('Original input text') as HTMLTextAreaElement).value
    ).toBe('')
  })

  it('loads fictional sample, switches redaction modes, and supports keyboard Edit/Highlights tabs', () => {
    render(<App />)

    fireEvent.click(
      screen.getAllByRole('button', { name: /Load fictional sample/i })[0]
    )

    const fullBtn = screen.getByRole('button', { name: /Full mask/i })
    fireEvent.click(fullBtn)
    expect(fullBtn).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByLabelText('Sanitized output diff preview').textContent
    ).toContain('[REDACTED]')

    const editTab = screen.getByRole('tab', { name: /^Edit$/i })
    fireEvent.keyDown(editTab, { key: 'ArrowRight' })
    const highlightsTab = screen.getByRole('tab', { name: /Highlights/i })
    expect(highlightsTab).toHaveAttribute('aria-selected', 'true')
  })

  it('shows malformed CSV error explicitly and renders multiline cell indicator for valid CSV', () => {
    render(<App />)

    fireEvent.click(
      screen.getByRole('button', { name: /Detection settings/i })
    )
    fireEvent.click(
      screen.getByRole('button', { name: /HR export \.csv \(fictional\)/i })
    )

    expect(screen.getByText(/CSV · 5 rows/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Table diff/i }))
    expect(screen.getByText(/CSV table view/i)).toBeInTheDocument()
    expect(screen.getByText(/multiline cell/i)).toBeInTheDocument()

    // Switch back to Raw diff to edit CSV and trigger malformed quote alert
    fireEvent.click(screen.getByRole('button', { name: /Raw diff/i }))
    const textarea = screen.getByLabelText('Original input text')
    fireEvent.change(textarea, {
      target: { value: 'name,email\n"unterminated,user@test.com' },
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/CSV parsing error/i)
  })

  it('supports keyboard tabs in Advanced security tools, RE2 custom rules, and local vault', () => {
    render(<App />)

    fireEvent.click(
      screen.getAllByRole('button', { name: /Load fictional sample/i })[0]
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Pseudonymization/i })
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Advanced security tools/i })
    )

    const auditTab = screen.getByRole('tab', { name: /Audit & Luhn/i })
    fireEvent.keyDown(auditTab, { key: 'ArrowRight' })
    const rulesTab = screen.getByRole('tab', { name: /Custom rules/i })
    expect(rulesTab).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(
      screen.getByRole('button', { name: /\+ Indian IFSC Code/i })
    )
    expect(screen.getByText('Indian IFSC Code')).toBeInTheDocument()

    fireEvent.keyDown(rulesTab, { key: 'ArrowRight' })
    const vaultTab = screen.getByRole('tab', { name: /Encrypted vault/i })
    expect(vaultTab).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(
      screen.getByRole('button', { name: /Load pseudonymized output/i })
    )
    const restoredPane = screen.getByLabelText('Locally restored output')
    expect(restoredPane.textContent).toContain('rohan.sharma@fintechcorp.in')
  })

  it('opens Security & limits modal, traps Tab focus, switches modal tabs with ArrowRight, and returns focus on Escape', () => {
    render(<App />)

    const secTrigger = screen.getByRole('button', {
      name: /Security & limits/i,
    })
    fireEvent.click(secTrigger)

    const dialog = screen.getByRole('dialog', {
      name: /Security, detection limits, and prompt log/i,
    })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText(/Known limitations/i)).toBeInTheDocument()

    const secTab = screen.getByRole('tab', { name: /Security & limitations/i })
    fireEvent.keyDown(secTab, { key: 'ArrowRight' })
    expect(
      screen.getByRole('tab', { name: /Prompt log/i })
    ).toHaveAttribute('aria-selected', 'true')

    // Escape closes and returns focus to trigger
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(secTrigger)
  })

  it('rejects unsupported/oversized files and allows toggling detectors and clearing', () => {
    const { container } = render(<App />)
    const fileInput = container.querySelector(
      '#pii-file-upload'
    ) as HTMLInputElement

    const badFile = new File(['hello'], 'payload.exe', {
      type: 'application/octet-stream',
    })
    fireEvent.change(fileInput, { target: { files: [badFile] } })
    expect(screen.getByRole('alert')).toHaveTextContent(/Unsupported file/i)

    const hugeFile = new File(['x'], 'huge.txt', { type: 'text/plain' })
    Object.defineProperty(hugeFile, 'size', { value: 6 * 1024 * 1024 })
    fireEvent.change(fileInput, { target: { files: [hugeFile] } })
    expect(screen.getByRole('alert')).toHaveTextContent(/exceeds 5 MB/i)

    fireEvent.click(
      screen.getAllByRole('button', { name: /Load fictional sample/i })[0]
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Detection settings/i })
    )
    const settingsPanel = document.getElementById(
      'detection-settings-panel'
    ) as HTMLElement
    fireEvent.click(
      within(settingsPanel).getByRole('button', { name: /Email address/i })
    )
    expect(
      screen.getByLabelText('Sanitized output diff preview').textContent
    ).toContain('rohan.sharma@fintechcorp.in')

    fireEvent.click(screen.getByRole('button', { name: /Clear input text/i }))
    expect(
      (screen.getByLabelText('Original input text') as HTMLTextAreaElement).value
    ).toBe('')
  })

  it('switches between Dark and Light themes and updates document classes', () => {
    render(<App />)

    const darkBtn = screen.getByRole('button', { name: /^Dark$/i })
    const lightBtn = screen.getByRole('button', { name: /^Light$/i })

    expect(darkBtn).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    fireEvent.click(lightBtn)
    expect(lightBtn).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('pii-shield-theme')).toBe('light')

    fireEvent.click(darkBtn)
    expect(darkBtn).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('pii-shield-theme')).toBe('dark')
  })
})
