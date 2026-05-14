import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getSuppliers, 
  getSupplier, 
  createSupplier, 
  updateSupplier,
  updateSupplierStatus,
  deleteSupplier
} from "@/modules/suppliers/api/suppliers.api";

export function useSuppliers(params = {}) {
  return useQuery({
    queryKey: ["suppliers", params],
    queryFn: () => getSuppliers(params),
    placeholderData: keepPreviousData
  });
}

export function useSupplier(id) {
  return useQuery({
    queryKey: ["suppliers", id],
    queryFn: () => getSupplier(id),
    enabled: !!id
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    }
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, payload }) => updateSupplier(id, payload),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers", variables.id] });
    }
  });
}

export function useUpdateSupplierStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, status }) => updateSupplierStatus(id, status),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers", variables.id] });
    }
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    }
  });
}
