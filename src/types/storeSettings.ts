export interface StoreProfile {
  name: string
  address: string
  contact: string
  timeZone: string
}

export interface TimePeriod {
  start: string
  end: string
}

export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'

export interface TemporaryClosure {
  date: string
  reason: string
}

export type ServiceType = 'ORDER' | 'RESERVATION'

export interface StoreSchedule {
  businessHours: Partial<Record<DayOfWeek, TimePeriod[]>>
  regularClosedDays: DayOfWeek[]
  temporaryClosures: TemporaryClosure[]
  serviceWindows: Partial<Record<ServiceType, Partial<Record<DayOfWeek, TimePeriod[]>>>>
}

export type FeatureCode = 'WAITING' | 'RESERVATION' | 'QR_ORDER' | 'PICKUP_ORDER'

export type NotificationEventCode =
  | 'WAITING_REGISTERED'
  | 'WAITING_CALLED'
  | 'RESERVATION_REQUESTED'
  | 'RESERVATION_APPROVED'
  | 'RESERVATION_REJECTED'
  | 'RESERVATION_CHANGED'
  | 'RESERVATION_CHANGE_REJECTED'
  | 'RESERVATION_CANCELLED'
  | 'RESERVATION_REMINDER'
  | 'PICKUP_ORDER_RECEIVED'
  | 'PICKUP_READY'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_CANCELLED'

export interface StoreFeatureSettings {
  customerFeatures: Record<FeatureCode, boolean>
  notificationEvents: Record<NotificationEventCode, boolean>
}

export interface StoreSettings {
  profile: StoreProfile
  schedule: StoreSchedule
  features: StoreFeatureSettings
  version: number
}

export interface UpdateStoreProfileRequest {
  name: string
  address: string
  contact: string
  timeZone: string
}

export interface UpdateStoreScheduleRequest {
  businessHours: Partial<Record<DayOfWeek, TimePeriod[]>>
  regularClosedDays: DayOfWeek[]
  temporaryClosures: TemporaryClosure[]
  serviceWindows: Partial<Record<ServiceType, Partial<Record<DayOfWeek, TimePeriod[]>>>>
}

export interface UpdateStoreFeaturesRequest {
  customerFeatures: Record<FeatureCode, boolean>
  notificationEvents: Record<NotificationEventCode, boolean>
}

export interface StoreProfileUpdateResult {
  profile: StoreProfile
  version: number
}

export interface StoreScheduleUpdateResult {
  schedule: StoreSchedule
  version: number
}

export interface StoreFeatureSettingsUpdateResult {
  features: StoreFeatureSettings
  version: number
}
