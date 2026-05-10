import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { isMarketOpen } from '../utils/format'

const api = axios.create({ baseURL: '/api' })

export function useAuthStatus() {
  return useQuery({
    queryKey: ['auth-status'],
    queryFn: () => api.get('/auth/status').then(r => r.data),
    refetchInterval: 3000,
  })
}

export function useLogin() {
  return useMutation({
    mutationFn: () => api.post('/auth/login').then(r => r.data),
  })
}

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: () => api.get('/portfolio').then(r => r.data),
    staleTime: 5 * 60 * 1000,
    refetchInterval: () => isMarketOpen() ? 5 * 60 * 1000 : false,
  })
}

export function useRefresh() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/portfolio/refresh').then(r => r.data),
    onSuccess: (data) => qc.setQueryData(['portfolio'], data),
  })
}

export function useBenchmark(symbol, period) {
  return useQuery({
    queryKey: ['benchmark', symbol, period],
    queryFn: () => api.get(`/benchmark/${symbol}?period=${period}`).then(r => r.data),
    staleTime: 60 * 60 * 1000,
  })
}

export function useAllBenchmarks(period) {
  return useQuery({
    queryKey: ['benchmark-all', period],
    queryFn: () => api.get(`/benchmark/all?period=${period}`).then(r => r.data),
    staleTime: 60 * 60 * 1000,
  })
}
