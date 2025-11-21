<script setup lang="ts">
import { computed } from 'vue';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

const props = defineProps<{
  text: string;
}>();

// Initialize parser with configuration suitable for chat
const md = new MarkdownIt({
  html: false,        // Disable HTML tags in source for security
  breaks: true,       // Convert '\n' in paragraphs into <br>
  linkify: true,      // Autoconvert URL-like text to links
  typographer: true   // Enable smartquotes and other typographic replacements
});

// Compute the sanitized HTML
const safeHtml = computed(() => {
  if (!props.text) return '';
  const rawHtml = md.render(props.text);
  // Sanitize the resulting HTML to prevent XSS
  return DOMPurify.sanitize(rawHtml, {
    // Allow specific tags/attributes for formatted text
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li', 'code', 'pre', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'],
    ALLOWED_ATTR: ['href', 'target', 'rel']
  });
});
</script>

<template>
  <!-- v-html is safe here because we used DOMPurify -->
  <div class="markdown-content" v-html="safeHtml"></div>
</template>

<style scoped>
/* Scoped styles to ensure Markdown looks good inside Vuetify components */
.markdown-content :deep(p) {
  margin-bottom: 8px;
}

.markdown-content :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-content :deep(ul), 
.markdown-content :deep(ol) {
  padding-left: 24px;
  margin-bottom: 8px;
}

.markdown-content :deep(li) {
  margin-bottom: 4px;
}

.markdown-content :deep(a) {
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
  font-weight: 500;
}

.markdown-content :deep(code) {
  background-color: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Roboto Mono', monospace;
  font-size: 0.9em;
}

.markdown-content :deep(pre) {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  margin-bottom: 8px;
}

.markdown-content :deep(pre code) {
  background-color: transparent;
  padding: 0;
}

.markdown-content :deep(blockquote) {
  border-left: 4px solid rgb(var(--v-theme-primary));
  padding-left: 16px;
  margin-left: 0;
  font-style: italic;
  opacity: 0.8;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  margin-top: 16px;
  margin-bottom: 8px;
  font-weight: 600;
}

.markdown-content :deep(h1) { font-size: 1.5em; }
.markdown-content :deep(h2) { font-size: 1.3em; }
.markdown-content :deep(h3) { font-size: 1.1em; }
</style>
