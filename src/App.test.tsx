import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('PII Shield UI', () => {
  it('starts with a clean empty workspace and local browser indicator', () => {
    render(<App />)

    expect(screen.getByText('PII Shield')).toBeInTheDocument()
    expect(screen.getAllByText(/Processed in this browser/i).length).toBeGreaterThan(0)
    expect(
      screen.getByText(/Paste text or upload a file/i)
    ).toBeInTheDocument()
    expect(
      (screen.getByLabelText('Original input text') as HTMLTextAreaElement).value
    ).toBe('')
  })

  it('loads fictional sample in 1 click and switches redaction modes', () => {
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

    const pseudoBtn = screen.getByRole('button', {
      name: /Pseudonymization/i,
    })
    fireEvent.click(pseudoBtn)
    expect(pseudoBtn).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByLabelText('Sanitized output diff preview').textContent
    ).toContain('EMAIL_01')
  })

  it('loads fictional CSV sample via Detection settings and displays multiline cell badge in Table diff', () => {
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
  })

  it('supports keyboard tabs in Advanced security tools, custom rules, and round-trip vault', () => {
    render(<App />)

    fireEvent.click(
      screen.getAllByRole('button', { name: /Load fictional sample/i })[0]
    )
    fireEvent.click(screen.getByRole('button', { name: /Pseudonymization/i }))
    fireEvent.click(
      screen.getByRole('button', { name: /Advanced security tools/i })
    )

    const auditTab = screen.getByRole('tab', { name: /Audit & Luhn/i })
    fireEvent.keyDown(auditTab, { key: 'ArrowRight' })
    const rulesTab = screen.getByRole('tab', { name: /Custom rules/i })
    expect(rulesTab).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(screen.getByRole('button', { name: /\+ Indian IFSC Code/i }))
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

  it('traps focus in Prompt Log modal and restores focus to trigger on Escape', () => {
    render(<App />)

    const trigger = screen.getByRole('button', { name: /Prompt log/i })
    fireEvent.click(trigger)
    expect(
      screen.getByRole('dialog', {
        name: /Prompt engineering log and security architecture/i,
      })
    ).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(trigger)
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
})
