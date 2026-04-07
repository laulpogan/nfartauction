import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppraisalForm, type AppraisalRow } from './AppraisalForm'

describe('AppraisalForm', () => {
  it('renders title, formNumber, and a row', () => {
    const rows: AppraisalRow[] = [{ label: 'PRESTIGE', value: '42' }]
    render(
      <AppraisalForm
        title="GALLERY APPRAISAL"
        formNumber="FORM A-14"
        rows={rows}
      />,
    )
    expect(screen.getByText('GALLERY APPRAISAL')).toBeTruthy()
    expect(screen.getByText('FORM A-14')).toBeTruthy()
    expect(screen.getByText('PRESTIGE')).toBeTruthy()
    expect(screen.getByText('42')).toBeTruthy()
  })

  it('emphasis row renders with font-bold class', () => {
    const rows: AppraisalRow[] = [
      { label: 'TOTAL', value: '$1,000', emphasis: true },
    ]
    const { container } = render(
      <AppraisalForm title="T" rows={rows} />,
    )
    const dd = container.querySelector('dd')
    expect(dd).toBeTruthy()
    expect(dd!.className).toContain('font-bold')
  })

  it('does NOT render a footer element when footer is omitted', () => {
    const rows: AppraisalRow[] = [{ label: 'A', value: '1' }]
    const { container } = render(
      <AppraisalForm title="T" rows={rows} />,
    )
    expect(container.querySelector('[data-appraisal-footer]')).toBeNull()
  })

  it('renders footer when provided', () => {
    const rows: AppraisalRow[] = [{ label: 'A', value: '1' }]
    render(
      <AppraisalForm
        title="T"
        rows={rows}
        footer={<span>APPRAISER SIGNATURE</span>}
      />,
    )
    expect(screen.getByText('APPRAISER SIGNATURE')).toBeTruthy()
  })

  it('renders rows in the order given', () => {
    const rows: AppraisalRow[] = [
      { label: 'ALPHA', value: '1' },
      { label: 'BETA', value: '2' },
      { label: 'GAMMA', value: '3' },
    ]
    const { container } = render(<AppraisalForm title="T" rows={rows} />)
    const labels = Array.from(container.querySelectorAll('dt')).map(el =>
      el.textContent,
    )
    expect(labels).toEqual(['ALPHA', 'BETA', 'GAMMA'])
  })
})
