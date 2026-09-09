<template>
  <div class="mb-4">
    <label class="block text-primary-0 mb-2" for="coach-photo">上傳教練照片</label>
    <input id="coach-photo" type="file" accept="image/png,image/jpeg,image/webp" :disabled="busy"
      class="block w-full text-primary-0" @change="upload" />
    <p class="text-primary-300 text-sm mt-2" aria-live="polite">{{ message || 'PNG、JPEG 或 WebP，最大 2 MB。上傳後請儲存資料。' }}</p>
  </div>
</template>
<script setup>
import { ref } from 'vue';
import request from '../api/request.js';
const emit = defineEmits(['uploaded', 'busy']);
const busy = ref(false);
const message = ref('');
async function upload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024 || !file.size) {
    message.value = '請選擇 2 MB 以下的 PNG、JPEG 或 WebP 圖片';
    return;
  }
  busy.value = true;
  emit('busy', true);
  message.value = '照片上傳中…';
  try {
    const { data } = await request.post('upload', { content_type: file.type, size: file.size });
    const response = await fetch(data.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!response.ok) throw new Error('照片上傳失敗，請重新選擇檔案');
    const confirmed = await request.post('upload/confirm', { key: data.key });
    emit('uploaded', confirmed.data);
    message.value = '照片已上傳，請儲存資料。';
  } catch (error) {
    message.value = error.response?.data?.message || error.message;
  } finally {
    busy.value = false;
    emit('busy', false);
    event.target.value = '';
  }
}
</script>
