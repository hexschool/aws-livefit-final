<template>
  <div class="max-w-4xl mx-auto">
    <div class="mb-8">
      <h3 class="text-4xl font-bold text-primary-0">教練資格管理</h3>
      <p class="mt-2 text-lg text-primary-300 leading-relaxed">
        將您的帳號升級為教練身份，開始您的線上教學服務。
      </p>
    </div>

    <div class="bg-primary-800 rounded-lg shadow-md p-8 max-w-2xl mx-auto border-4 border-primary-600">
      <div class="text-center mb-6">
        <div
          class="w-20 h-20 mx-auto bg-gradient-to-br from-secondary-800 to-secondary-600 rounded-full flex items-center justify-center"
        >
          <svg
            class="w-10 h-10 text-primary-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        </div>
      </div>

      <div class="text-center mb-8">
        <h4 class="text-2xl font-semibold text-primary-0 mb-3">
          {{ isCoach ? "您已是教練身份" : "升級為教練" }}
        </h4>
        <p class="text-primary-300">
          {{
            isCoach
              ? "您目前擁有教練權限，可以建立課程並開始教學"
              : "成為教練後，您將可以建立課程、管理學員，並開始您的教學事業"
          }}
        </p>
      </div>

      <div v-if="!isCoach" class="mb-8">
        <div class="space-y-6">
          <div>
            <CoachPhotoUpload @uploaded="photo => { formData.profile_image_key = photo.key; formData.profile_image_url = photo.image_url; }" @busy="value => photoBusy = value" />
            <div
              v-if="formData.profile_image_url"
              class="w-32 h-32 mx-auto rounded-full overflow-hidden bg-primary-700"
            >
              <img
                :src="formData.profile_image_url"
                alt="教練照片預覽"
                class="w-full h-full object-cover"
                @error="handleImageError"
              />
            </div>
            <div
              v-else
              class="w-32 h-32 mx-auto rounded-full bg-primary-700 flex items-center justify-center"
            >
              <svg
                class="w-16 h-16 text-primary-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          </div>

          <div>
            <label
              for="experience"
              class="block text-sm font-semibold text-primary-0 mb-2"
            >
              教學經驗年資 <span class="text-secondary-800">*</span>
            </label>
            <input
              id="experience"
              v-model.number="formData.experience_years"
              type="number"
              min="0"
              placeholder="請輸入教學年資"
              class="w-full px-4 py-2 border-2 border-primary-600 bg-primary-900 text-primary-0 rounded-lg outline-none focus:border-secondary-800 placeholder:text-primary-400"
            />
          </div>

          <div>
            <label
              for="description"
              class="block text-sm font-semibold text-primary-0 mb-2"
            >
              教練簡介 <span class="text-secondary-800">*</span>
            </label>
            <textarea
              id="description"
              v-model="formData.description"
              rows="4"
              placeholder="請簡單介紹您的專業背景、教學特色..."
              class="w-full px-4 py-2 border-2 border-primary-600 bg-primary-900 text-primary-0 rounded-lg outline-none focus:border-secondary-800 resize-none placeholder:text-primary-400"
            ></textarea>
          </div>
        </div>
      </div>

      <div class="text-center">
        <button
          v-if="!isCoach"
          @click="promoteToCoach"
          :disabled="photoBusy"
          class="px-8 py-3 bg-gradient-to-r from-secondary-800 to-secondary-600 text-primary-900 text-lg font-semibold rounded-lg hover:shadow-lg hover:scale-105 transform transition-all duration-200"
        >
          立即升級為教練
        </button>

        <div
          v-else
          class="inline-flex items-center px-6 py-3 bg-success-50 text-success-700 rounded-lg border-2 border-success-200"
        >
          <svg class="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
          <span class="font-semibold">已擁有教練資格</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import CoachPhotoUpload from "../../components/CoachPhotoUpload.vue";
import { ref, onMounted, getCurrentInstance } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useUserStore } from "../../stores/user.js";
import { postPromoteUserToCoach } from "../../api/index.js";
import { jwtDecode } from "jwt-decode";
import { getDataFromCookieByKey, removeCookie } from "../../utils/cookie.js";
import swalHandler from "../../utils/swalHandler.js";

const { role } = storeToRefs(useUserStore());
const { setCurrentUser } = useUserStore();
const { proxy } = getCurrentInstance();
const router = useRouter();

const isCoach = ref(false);
const photoBusy = ref(false);
const formData = ref({
  profile_image_key: null,
  experience_years: 0,
  description: "",
  profile_image_url: "",
});

async function checkCoachStatus() {
  if (role.value === "COACH") {
    isCoach.value = true;
    return;
  }
}

function handleImageError() {
  swalHandler(proxy.$swal, "照片載入失敗，請重新整理頁面");
}

async function promoteToCoach() {
  try {
    const { id } = jwtDecode(getDataFromCookieByKey("token"));

    const { status } = await postPromoteUserToCoach(id, { ...formData.value, profile_image_url: formData.value.profile_image_key ? null : formData.value.profile_image_url });

    if (status === "success") {
      swalHandler(proxy.$swal, "升級教練成功");
      setTimeout(() => {
        removeCookie("token");
        setCurrentUser({ name: "", role: "" });
        proxy.$swal.close();
        router.push("/login");
      }, 3000);
    }
  } catch (error) {
    let msg = error.message;

    if (Object.hasOwn(error.response, "data")) {
      const { status, message } = error.response.data;
      msg = message;

      if (status === "failed") {
        swalHandler(proxy.$swal, message);
        return;
      }
    }

    throw new Error(`[promoteToCoach] error : ${msg}`);
  }
}

onMounted(() => {
  checkCoachStatus();
});
</script>
