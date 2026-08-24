import { ANONYMOUS, loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { toSafeInteger, type Int64String } from '@/api/int64'

export interface TossPaymentRequest {
  clientKey: string
  amount: Int64String
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
  // The provider SDK only accepts a JavaScript number, so the server amount is converted at this
  // boundary only, and only after proving it survives the conversion exactly. It is never rounded.
  const amount = tossSafeAmount(request.amount)

  const tossPayments = await loadTossPayments(clientKey)
  const widgets = tossPayments.widgets({ customerKey: ANONYMOUS })
  await widgets.setAmount({
    currency: request.currency,
    value: amount,
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
    super('결제를 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.')
    this.name = 'TossPaymentConfigurationError'
  }
}

function tossSafeAmount(value: Int64String): number {
  let amount: number
  try {
    amount = toSafeInteger(value)
  } catch {
    throw new TossPaymentAmountError()
  }
  if (amount <= 0) throw new TossPaymentAmountError()
  return amount
}

export class TossPaymentAmountError extends Error {
  constructor() {
    super('결제 가능한 금액 범위를 확인해 주세요.')
    this.name = 'TossPaymentAmountError'
  }
}

export function tossPaymentErrorMessage(error: unknown): string {
  if (error instanceof TossPaymentConfigurationError || error instanceof TossPaymentAmountError) {
    return error.message
  }

  const code = readErrorCode(error)
  const messageByCode: Record<string, string> = {
    USER_CANCEL: '결제창을 닫았습니다. 결제는 승인되지 않았습니다.',
    PAY_PROCESS_CANCELED: '사용자가 결제를 취소했습니다.',
    PAY_PROCESS_ABORTED: '결제 인증이 중단되었습니다. 결제 정보를 확인해 주세요.',
    REJECT_CARD_COMPANY: '카드사에서 결제를 거절했습니다.',
    NETWORK_ERROR: '결제 화면을 열지 못했습니다. 잠시 후 다시 시도해 주세요.',
  }
  return messageByCode[code] ?? '토스페이먼츠 결제창을 열지 못했습니다.'
}

function readErrorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return ''
  }
  return typeof error.code === 'string' ? error.code : ''
}
