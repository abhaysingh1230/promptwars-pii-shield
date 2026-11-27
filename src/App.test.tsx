import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('PII Shield UI', () => {
  it('renders zero-server header, default sample output, and live counts', () => {
    render(<App />)

    expect(screen.getByText('PII Shield')).toBeInTheDocument()
    expect(screen.getByText(/0 outbound requests/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Original input')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Sanitized output diff preview')
    ).toBeInTheDocument()
  })

  it('switches between Full Mask, Partial Mask, and Consistent Pseudonym modes', () => {
    render(<App />)

    const fullBtn = screen.getByRole('button', { name: /Full mask/i })
    fireEvent.click(fullBtn)
    expect(fullBtn).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByLabelText('Sanitized output diff preview').textContent
    ).toContain('[REDACTED]')

    const pseudoBtn = screen.getByRole('button', {
      name: /Consistent pseudonym/i,
    })
    fireEvent.click(pseudoBtn)
    expect(pseudoBtn).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByText(/Consistent pseudonym registry/i)
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Sanitized output diff preview').textContent
    ).toContain('EMAIL_01')
  })

  it('loads 1-click CSV sample and switches between Raw Diff and Table Diff', () => {
    render(<App />)

    const csvSampleBtn = screen.getByRole('button', {
      name: /HR Onboarding Export/i,
    })
    fireEvent.click(csvSampleBtn)

    expect(screen.getByText(/CSV · 5 rows/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Download hr-csv\.sanitized\.csv/i })
    ).toBeInTheDocument()

    const tableBtn = screen.getByRole('button', { name: /Table diff/i })
    fireEvent.click(tableBtn)
    expect(screen.getByText(/Side-by-side CSV cell diff/i)).toBeInTheDocument()
  })

  it('adds custom IFSC preset rule and supports round-trip pseudonym restore', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('tab', { name: /Custom rules/i }))
    fireEvent.click(screen.getByRole('button', { name: /\+ Indian IFSC Code/i }))
    expect(screen.getByText('Indian IFSC Code')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /Consistent pseudonym/i })
    )
    fireEvent.click(screen.getByRole('tab', { name: /Round-trip vault/i }))
    fireEvent.click(
      screen.getByRole('button', { name: /Load pseudonymized output/i })
    )
    const restoredPane = screen.getByLabelText('Locally restored output')
    expect(restoredPane.textContent).toContain('rohan.sharma@fintechcorp.in')
  })

  it('opens and closes the Prompt Log & Security dialog', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /Prompt log/i }))
    expect(
      screen.getByRole('dialog', {
        name: /Prompt engineering log and security architecture/i,
      })
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /Close prompt log dialog/i })
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes Prompt Log dialog via Escape key for keyboard accessibility', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /Prompt log/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('rejects unsupported or oversized files with accessible alert and supports Clear & category filters', () => {
    const { container } = render(<App />)
    const fileInput = container.querySelector(
      '#pii-file-upload'
    ) as HTMLInputElement
    expect(fileInput).toBeInTheDocument()

    const badFile = new File(['hello'], 'payload.exe', {
      type: 'application/octet-stream',
    })
    fireEvent.change(fileInput, { target: { files: [badFile] } })
    expect(screen.getByRole('alert')).toHaveTextContent(/Unsupported file/i)

    const hugeFile = new File(['x'], 'huge.txt', { type: 'text/plain' })
    Object.defineProperty(hugeFile, 'size', { value: 6 * 1024 * 1024 })
    fireEvent.change(fileInput, { target: { files: [hugeFile] } })
    expect(screen.getByRole('alert')).toHaveTextContent(/exceeds 5 MB/i)

    const controls = screen.getByRole('region', {
      name: /Sanitization Controls and Sample Loader/i,
    })
    fireEvent.click(
      within(controls).getByRole('button', { name: /Email address/i })
    )
    expect(
      screen.getByLabelText('Sanitized output diff preview').textContent
    ).toContain('rohan.sharma@fintechcorp.in')

    fireEvent.click(screen.getByRole('button', { name: /Clear input text/i }))
    expect(
      (screen.getByLabelText('Original input') as HTMLTextAreaElement).value
    ).toBe('')
  })
})
