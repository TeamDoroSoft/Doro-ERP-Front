import { apiRequest } from './http'

export type TableStatus = 'ACTIVE' | 'INACTIVE'

export interface TableResponse {
  id: string
  tableNumber: string
  displayName: string
  status: TableStatus
  version: number
}

export interface TableDetailsRequest {
  tableNumber: string
  displayName: string
}

export function getTables(): Promise<TableResponse[]> {
  return apiRequest<TableResponse[]>('/tables')
}

export function createTable(request: TableDetailsRequest): Promise<TableResponse> {
  return apiRequest<TableResponse>('/tables', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function updateTable(id: string, request: TableDetailsRequest): Promise<TableResponse> {
  return apiRequest<TableResponse>(`/tables/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(request),
  })
}

export function changeTableStatus(id: string, status: TableStatus): Promise<TableResponse> {
  return apiRequest<TableResponse>(`/tables/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
