<script setup lang="ts">
import type { OrderServiceType } from '@/composables/useOrderDraft'
defineProps<{ modelValue: OrderServiceType }>()
defineEmits<{ 'update:modelValue': [value: OrderServiceType] }>()
</script>
<template>
  <fieldset class="service-type">
    <legend>주문 방식</legend>
    <label
      ><input
        type="radio"
        name="serviceType"
        value="DINE_IN"
        :checked="modelValue === 'DINE_IN'"
        @change="$emit('update:modelValue', 'DINE_IN')"
      />매장 식사</label
    ><label
      ><input
        type="radio"
        name="serviceType"
        value="TAKEOUT"
        :checked="modelValue === 'TAKEOUT'"
        @change="$emit('update:modelValue', 'TAKEOUT')"
      />포장</label
    >
  </fieldset>
</template>
<style scoped>
.service-type {
  display: flex;
  gap: 1rem;
  margin: 0;
  border: 0;
  padding: 0;
}
.service-type legend {
  margin-bottom: 0.5rem;
  font-weight: 700;
}
.service-type label {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}
</style>
