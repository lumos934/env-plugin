<script setup lang="ts">
import MainPage from './components/MainPage.vue'
</script>

<template>
  <header>
    <img
      alt="Vue logo"
      class="logo"
      src="./assets/logo.svg"
      width="25"
      height="25"
    />
    开发环境管理系统 -- 管理页面
  </header>
  <br />
  <main>
    <MainPage />
  </main>
</template>

<style scoped>
header {
  line-height: 1.5;
}
</style>
