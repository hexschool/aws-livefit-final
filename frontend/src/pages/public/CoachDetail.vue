<template>
  <div class="bg-primary-900 min-h-screen py-12 md:py-16 lg:py-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 2xl:px-0">
    <div
      v-if="errorMessage"
      class="flex items-center justify-center"
      :style="{ minHeight: contentHeight }"
    >
      <div
        class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-3xl"
      >
        {{ errorMessage }}
      </div>
    </div>
    <div
      v-if="!errorMessage"
      class="flex flex-col md:flex-row gap-6 md:gap-12 lg:gap-16 items-center md:items-start"
    >
      <img
        :src="coachDetail.coach.profile_image_url"
        alt="Coach Photo"
        class="w-40 h-40 sm:w-48 sm:h-48 md:w-52 md:h-52 rounded-full object-cover shadow-lg flex-shrink-0"
      />

      <div class="flex-1 w-full text-center md:text-left">
        <h5 class="text-3xl sm:text-4xl font-bold text-primary-0 mb-3 md:mb-4">
          {{ coachDetail.user.name }}
        </h5>
        <p class="text-lg sm:text-xl text-primary-300 mb-4 md:mb-6">
          教練經驗：{{ coachDetail.coach.experience_years }} 年
        </p>

        <h5 class="text-2xl sm:text-3xl font-bold text-primary-0 mb-3 md:mb-4">
          擅長領域
        </h5>
        <ul
          class="flex flex-wrap gap-3 sm:gap-4 md:gap-6 justify-center md:justify-start mb-4 md:mb-6"
        >
          <li
            v-for="skill in coachDetail.coach.skills"
            :key="skill"
            class="px-4 py-2 sm:px-5 sm:py-2 font-bold rounded-md text-base sm:text-lg border border-secondary-800 text-secondary-800"
          >
            {{ skill }}
          </li>
        </ul>
        <h5 class="text-2xl sm:text-3xl font-bold text-primary-0 mb-3 md:mb-4">
          關於 {{ coachDetail.user.name }} 教練
        </h5>
        <p class="text-primary-300">{{ coachDetail.coach.description }}</p>
      </div>
    </div>

    <div v-if="!errorMessage" class="mt-12 md:mt-16">
      <h5 class="text-2xl sm:text-3xl font-bold text-primary-0 mb-6 md:mb-8">
        最近開課
      </h5>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="course in coachCourseList"
          :key="course.id"
          class="bg-primary-800 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden border border-primary-600"
        >
          <div class="p-4 sm:p-5 md:p-6">
            <div class="flex items-start justify-between mb-4 gap-2">
              <h6
                class="text-xl sm:text-2xl md:text-3xl font-bold text-primary-0 flex-1"
              >
                {{ course.name }}
              </h6>
              <span
                class="px-3 py-1 sm:px-4 sm:py-1.5 text-base sm:text-lg md:text-xl font-semibold rounded-full bg-secondary-800/10 text-secondary-800 whitespace-nowrap"
              >
                {{ course.skill_name }}
              </span>
            </div>

            <p
              class="text-sm sm:text-base md:text-lg text-primary-300 mb-4 sm:mb-5 md:mb-6 line-clamp-2"
            >
              {{ course.description }}
            </p>

            <div class="space-y-2 sm:space-y-3">
              <div class="flex items-center text-primary-300">
                <svg
                  class="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-secondary-800 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span class="text-sm sm:text-base md:text-lg whitespace-nowrap">
                  <span class="font-bold">課程時間：</span
                  >{{ formatCourseDateTime(course.start_at, course.end_at) }}
                </span>
              </div>

              <div class="flex items-center text-primary-300">
                <svg
                  class="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-secondary-800 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <span class="text-sm sm:text-base md:text-lg"
                  ><span class="font-bold">名額：</span
                  >{{ course.max_participants }} 人</span
                >
              </div>
            </div>

            <button
              @click="
                openConfirmWhetherToRegisterModal(
                  course.coach_name,
                  course.name,
                  course.id
                )
              "
              class="mt-5 sm:mt-6 md:mt-7 w-full bg-secondary-800 text-primary-900 font-semibold py-2.5 sm:py-3 md:py-3.5 px-4 sm:px-5 md:px-6 text-base sm:text-lg md:text-xl rounded-md hover:bg-secondary-800/90 transition-colors duration-300"
            >
              立即報名
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>
  </div>
  <ConfirmWhetherToRegisterModal
    v-if="confirmWhetherToRegisterModal"
    :coach_name="confirmWhetherToRegisterInfo.coach_name"
    :name="confirmWhetherToRegisterInfo.name"
    :id="confirmWhetherToRegisterInfo.id"
    @closeConfirmWhetherToRegisterModal="closeConfirmWhetherToRegisterModal"
    @confirmRegistration="confirmRegistration"
  ></ConfirmWhetherToRegisterModal>
  <RedirectModal
    v-if="redirectModal"
    :message="redirectInfo.message"
    :button-text="redirectInfo.button_text"
    :button-link="redirectInfo.button_link"
    @closeRedirectModal="closeRedirectModal"
  ></RedirectModal>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import {
  getCoachDetail,
  getCoachCourses,
  postCourse,
} from "../../api/index.js";
import { formatCourseDateTime } from "../../utils/formatDateTime.js";
import ConfirmWhetherToRegisterModal from "../../components/ConfirmWhetherToRegisterModal.vue";
import RedirectModal from "../../components/RedirectModal.vue";

const route = useRoute();

const errorMessage = ref("");
const contentHeight = ref("");

const coachDetail = ref({
  user: {},
  coach: {},
});
const coachCourseList = ref([]);
const redirectModal = ref(false);
const redirectInfo = ref({});
const confirmWhetherToRegisterModal = ref(false);
const confirmWhetherToRegisterInfo = ref({});

const redirectModalTable = {
  success: () =>
    openRedirectModal("報名成功！", "前往課程儀表板", "/user/dashboard"),
  已經報名過此課程: () =>
    openRedirectModal(
      "您已報名過此課程！",
      "前往課程儀表板",
      "/user/dashboard"
    ),
  已無可使用堂數: () =>
    openRedirectModal(
      "您購買堂數不足請先續約健身方案",
      "前往健身方案",
      "/fitness-plans"
    ),
  "已達最大參加人數，無法參加": () =>
    openRedirectModal("已達最大參加人數，無法參加", "前往尋找教練", "/coaches"),
  請先登入: () =>
    openRedirectModal(
      "您尚未登入，請先登入以繼續操作。",
      "前往登入頁面",
      "/login"
    ),
};

function openRedirectModal(message, button_text, button_link) {
  redirectInfo.value = { message, button_text, button_link };
  redirectModal.value = true;
}
function closeRedirectModal() {
  redirectModal.value = false;
}
function openConfirmWhetherToRegisterModal(coach_name, name, id) {
  confirmWhetherToRegisterInfo.value = { coach_name, name, id };
  confirmWhetherToRegisterModal.value = true;
}
function closeConfirmWhetherToRegisterModal() {
  confirmWhetherToRegisterModal.value = false;
}

async function confirmRegistration(id) {
  try {
    const { status, notification } = await postCourse(id);

    if (status === "success") {
      if (notification?.status === "failed") {
        openRedirectModal("報名成功，通知信寄送失敗；您仍可從課表查看報名。", "前往課程儀表板", "/user/dashboard");
      } else {
        redirectModalTable[status]();
      }
    }
  } catch (error) {
    let msg = error.message;

    if (Object.hasOwn(error.response, "data")) {
      const { status, message } = error.response.data;
      msg = message;

      if (status === "failed" && Object.hasOwn(redirectModalTable, message)) {
        redirectModalTable[message]();
        return;
      }
    }

    throw new Error(`[confirmRegistration] error : ${msg}`);
  }
}

function getCoachId() {
  return route.params.coachId;
}

async function getCoachInfo() {
  try {
    const id = getCoachId();
    const { data } = await getCoachDetail(id);

    coachDetail.value = data;
  } catch (error) {
    let msg = error.message;

    if (Object.hasOwn(error.response, "data")) {
      const { status, message } = error.response.data;

      msg = message;
      if (status === "failed") {
        errorMessage.value = message;
        calculateContentHeight();
        return;
      }
    }

    throw new Error(`[getCoachInfo] error : ${msg}`);
  }
}

async function getCoachCourseList() {
  try {
    const id = getCoachId();
    const { data } = await getCoachCourses(id);

    coachCourseList.value = data;
  } catch (error) {
    let msg = error.message;

    if (Object.hasOwn(error.response, "data")) {
      const { message } = error.response.data;
      msg = message;
    }

    throw new Error(`[getCoachCourseList] error : ${msg}`);
  }
}

function calculateContentHeight() {
  const header = document.querySelector("header");
  const footer = document.querySelector("footer");

  const headerHeight = header ? header.offsetHeight : 0;
  const footerHeight = footer ? footer.offsetHeight : 0;

  const availableHeight = window.innerHeight - headerHeight - footerHeight;
  contentHeight.value = `${availableHeight}px`;
}

onMounted(() => {
  getCoachInfo();
  getCoachCourseList();
});
</script>
