<template><div class="loading-state" role="status"><span aria-hidden="true" />데이터를 불러오는 중입니다.</div></template>
<style scoped>
.loading-state { display: flex; min-height: 120px; align-items: center; justify-content: center; gap: 10px; color: var(--color-muted); }
.loading-state span { width: 18px; height: 18px; border: 2px solid #c7d2fe; border-top-color: var(--color-primary); border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
