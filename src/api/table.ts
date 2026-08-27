import { apiRequestExact } from './http'
import type { Int64String } from './int64'

export type TableStatus = 'ACTIVE' | 'INACTIVE'

export interface TableResponse {
  id: string
  tableNumber: string
  displayName: string
  status: TableStatus
  /** Store Access optimistic-lock counter (Java `long`). */
  version: Int64String
}

export interface TableDetailsRequest {
  tableNumber: string
  displayName: string
}

const TABLE_INT64 = { fields: ['version'] } as const

export function getTables(): Promise<TableResponse[]> {
  return apiRequestExact<TableResponse[]>('/tables', {}, TABLE_INT64)
}

export function getInactiveTables(): Promise<TableResponse[]> {
  return apiRequestExact<TableResponse[]>('/tables?status=INACTIVE', {}, TABLE_INT64)
}

export function createTable(request: TableDetailsRequest): Promise<TableResponse> {
  return apiRequestExact<TableResponse>(
    '/tables',
    { method: 'POST', body: JSON.stringify(request) },
    TABLE_INT64,
  )
}

export function updateTable(id: string, request: TableDetailsRequest): Promise<TableResponse> {
  return apiRequestExact<TableResponse>(
    `/tables/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(request) },
    TABLE_INT64,
  )
}

export function changeTableStatus(id: string, status: TableStatus): Promise<TableResponse> {
  return apiRequestExact<TableResponse>(
    `/tables/${encodeURIComponent(id)}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
    TABLE_INT64,
  )
}
