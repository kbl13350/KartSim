<script setup lang="ts">
import { session } from './session'
import ConsoleLayout from './views/ConsoleLayout.vue'
import LoginView from './views/LoginView.vue'

// Signing out (or a 401) unmounts the console, so the next admin starts clean.
</script>

<template>
  <ConsoleLayout v-if="session.admin" />
  <LoginView v-else />
</template>
