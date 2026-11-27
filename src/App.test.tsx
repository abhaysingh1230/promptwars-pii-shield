import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('PII Shield UI', () => {
  it('renders zero-server header, default sample output, and live counts', () => {
    render(<App />)

    expect(screen.getByText('PII Shield')).toBeInTheDocument()
    expect(screen.getByText('0 Outbound Requests')).toBeInTheDocument()
    expect(screen.getByLabelText('Original Input')).toBeInTheDocument()
    expect(screen.getByLabelText('Sanitized output diff preview')).toBeInTheDocument()
  })

  it('switches between Full Mask, Partial Mask, and Consistent Pseudonym modes', () => {
    render(<App />)

    const fullBtn = screen.getByRole('button', { name: /Full Mask/i })
    fireEvent.click(fullBtn)
    expect(fullBtn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Sanitized output diff preview').textContent).toContain(
      '[REDACTED]'
    )

    const pseudoBtn = screen.getByRole('button', {
      name: /Consistent Pseudonym/i,
    })
    fireEvent.click(pseudoBtn)
    expect(pseudoBtn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Consistent Pseudonym Registry')).toBeInTheDocument()
    expect(screen.getByLabelText('Sanitized output diff preview').textContent).toContain(
      'EMAIL_01'
    )
  })

  it('loads 1-click CSV sample and switches between Raw Diff and Table Diff', () => {
    render(<App />)

    const csvSampleBtn = screen.getByRole('button', {
      name: /HR Onboarding Export/i,
    })
    fireEvent.click(csvSampleBtn)

    expect(screen.getByText(/CSV Mode/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Download hr-csv\.sanitized\.csv/i })
    ).toBeInTheDocument()

    const tableBtn = screen.getByRole('button', { name: /Table Diff/i })
    fireEvent.click(tableBtn)
    expect(
      screen.getByText(/Side-by-Side CSV Cell Diff/i)
    ).toBeInTheDocument()
  })

  it('adds custom IFSC preset rule and supports round-trip pseudonym restore', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /\+ Indian IFSC Code/i }))
    expect(screen.getByText('Indian IFSC Code')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Consistent Pseudonym/i }))
    fireEvent.click(
      screen.getByRole('button', { name: /Load Pseudonymized Output/i })
    )
    const restoredPane = screen.getByLabelText('Locally restored output')
    expect(restoredPane.textContent).toContain('rohan.sharma@fintechcorp.in')
  })

  it('opens and closes the Prompt Log & Security dialog', () => {
    render(<App />)

    fireEvent.click(
      screen.getByRole('button', { name: /Prompt Log & Security/i })
    )
    expect(
      screen.getByRole('dialog', {
        name: /Prompt Engineering Log & Security Architecture/i,
      })
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /Close prompt log dialog/i })
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
