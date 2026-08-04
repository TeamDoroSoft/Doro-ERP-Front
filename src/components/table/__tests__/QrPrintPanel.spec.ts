import { flushPromises, mount } from '@vue/test-utils'
import QRCode from 'qrcode'
import { afterEach, describe, expect, it, vi } from 'vitest'
import QrPrintPanel from '@/components/table/QrPrintPanel.vue'

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi
      .fn<(text: string, options?: unknown) => Promise<string>>()
      .mockResolvedValue('data:image/png;base64,qr'),
  },
}))

describe('QrPrintPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders a QR with error correction M and at least 32mm print size', async () => {
    const wrapper = mount(QrPrintPanel, {
      props: {
        accessUrl: 'https://store.example/qr#token=secret-token',
        tableNumber: 'A1',
      },
    })

    await flushPromises()

    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      'https://store.example/qr#token=secret-token',
      expect.objectContaining({
        errorCorrectionLevel: 'M',
        margin: 4,
        width: 384,
      }),
    )
    const image = wrapper.get('img')
    expect(image.attributes('data-qr-error-correction')).toBe('M')
    expect(image.attributes('data-minimum-print-size')).toBe('32mm')
    expect(wrapper.text()).not.toContain('secret-token')
  })

  it('clears caller-owned QR state after print action', async () => {
    const print = vi.fn<() => void>()
    vi.stubGlobal('print', print)
    const wrapper = mount(QrPrintPanel, {
      props: {
        accessUrl: 'https://store.example/qr#token=secret-token',
        tableNumber: 'A1',
      },
    })

    await wrapper.get('button').trigger('click')

    expect(print).toHaveBeenCalledOnce()
    expect(wrapper.emitted('printed')).toHaveLength(1)
  })
})
