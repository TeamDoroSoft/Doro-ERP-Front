<script setup lang="ts">
import ManagementWorkspace from '@/components/management/ManagementWorkspace.vue'
import { workspaceDefinitions } from '@/views/management/workspaceDefinitions'
</script>
<template><ManagementWorkspace :definition="workspaceDefinitions.catalog" /></template>
