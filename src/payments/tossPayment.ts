import { ANONYMOUS, loadTossPayments } from '@tosspayments/tosspayments-sdk'

export interface TossPaymentRequest {
  clientKey: string
  amount: number
  currency: 'KRW'
  providerOrderId: string
  orderName: string
  successUrl: string
  failUrl: string
}

export async function requestTossPayment(request: TossPaymentRequest): Promise<void> {
  const clientKey = request.clientKey.trim()
  if (!/^test_gck_[A-Za-z0-9_-]+$/.test(clientKey)) {
    throw new TossPaymentConfigurationError()
  }

  const tossPayments = await loadTossPayments(clientKey)
  const widgets = tossPayments.widgets({ customerKey: ANONYMOUS })
  await widgets.setAmount({
    currency: request.currency,
    value: request.amount,
  })
  const paymentWindow = await widgets.renderPaymentWindow()
  paymentWindow.on('paymentRequest', async () => {
    await widgets.requestPayment({
      orderId: request.providerOrderId,
      orderName: request.orderName,
      successUrl: request.successUrl,
      failUrl: request.failUrl,
    })
  })
}

export class TossPaymentConfigurationError extends Error {
  constructor() {
    super('VITE_TOSS_CLIENT_KEY에는 test_gck_ 형식의 테스트 결제위젯 키만 사용할 수 있습니다.')
    this.name = 'TossPaymentConfigurationError'
  }
}

export function tossPaymentErrorMessage(error: unknown): string {
  if (error instanceof TossPaymentConfigurationError) {
    return error.message
  }

  const code = readErrorCode(error)
  const messageByCode: Record<string, string> = {
    USER_CANCEL: '결제창을 닫았습니다. 결제는 승인되지 않았습니다.',
    PAY_PROCESS_CANCELED: '사용자가 결제를 취소했습니다.',
    PAY_PROCESS_ABORTED: '결제 인증이 중단되었습니다. 결제 정보를 확인하세요.',
    REJECT_CARD_COMPANY: '카드사에서 결제를 거절했습니다.',
    NETWORK_ERROR: 'Toss Payments 연결에 실패했습니다. 잠시 후 다시 시도하세요.',
  }
  return messageByCode[code] ?? 'Toss Payments 결제창을 열지 못했습니다.'
}

function readErrorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return ''
  }
  return typeof error.code === 'string' ? error.code : ''
}
