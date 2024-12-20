<script setup lang="ts">
import type { GLOBAL_MODAL_LOADER_TYPE } from '@renderer/providers';

import { inject, onMounted, reactive, ref, watch } from 'vue';
import Tooltip from 'bootstrap/js/dist/tooltip';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';

import {
  loginLocal,
  registerLocal,
  resetDataLocal,
  getUsersCount,
} from '@renderer/services/userService';

import { GLOBAL_MODAL_LOADER_KEY } from '@renderer/providers';

import { isEmail, isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import useSetDynamicLayout from '@renderer/composables/useSetDynamicLayout';

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const router = useRouter();
const createTooltips = useCreateTooltips();
useSetDynamicLayout({
  loggedInClass: false,
  shouldSetupAccountClass: false,
  showMenu: false,
});

/* Injected */
const globalModalLoaderRef = inject<GLOBAL_MODAL_LOADER_TYPE>(GLOBAL_MODAL_LOADER_KEY);

/* State */
const inputEmail = ref('');
const inputPassword = ref('');
const inputConfirmPassword = ref('');
const buttonLoading = ref(false);

const inputEmailInvalid = ref(false);
const inputPasswordInvalid = ref(false);
const inputConfirmPasswordInvalid = ref(false);
const passwordRequirements = reactive({
  length: false,
  // lowercase: false,
  // uppercase: false,
  // number: false,
  // special: false,
});
const tooltipContent = ref('');
const shouldRegister = ref(false);
const keepLoggedIn = ref(false);
const isResetDataModalShown = ref(false);

/* Handlers */
const handleOnFormSubmit = async (event: Event) => {
  event.preventDefault();

  if (shouldRegister.value) {
    inputEmailInvalid.value = inputEmail.value.trim() === '' || !isEmail(inputEmail.value);
    inputPasswordInvalid.value =
      inputPassword.value.trim() === '' || !isPasswordStrong(inputPassword.value);
    inputConfirmPasswordInvalid.value =
      inputPassword.value.trim() !== inputConfirmPassword.value.trim();
  }

  if (
    shouldRegister.value &&
    !inputConfirmPasswordInvalid.value &&
    !inputEmailInvalid.value &&
    !inputPasswordInvalid.value
  ) {
    buttonLoading.value = true;
    const { id, email } = await registerLocal(
      inputEmail.value.trim(),
      inputPassword.value,
      keepLoggedIn.value,
    );

    await user.login(id, email, false);

    if (isUserLoggedIn(user.personal)) {
      user.setPassword(inputPassword.value);
    }

    router.push({ name: 'accountSetup' });
  } else if (!shouldRegister.value) {
    let userData: { id: string; email: string } | null = null;

    try {
      buttonLoading.value = true;
      userData = await loginLocal(
        inputEmail.value.trim(),
        inputPassword.value,
        keepLoggedIn.value,
        false,
      );
    } catch (error: any) {
      inputEmailInvalid.value = false;
      inputPasswordInvalid.value = false;

      if (error.message.includes('email')) {
        inputEmailInvalid.value = true;
      }
      if (error.message.includes('password')) {
        inputPasswordInvalid.value = true;
      }
    } finally {
      buttonLoading.value = false;
    }

    if (userData) {
      try {
        globalModalLoaderRef?.value?.open();
        await user.login(userData.id, userData.email.trim(), false);
        if (isUserLoggedIn(user.personal)) {
          user.setPassword(inputPassword.value);
        }

        if (user.secretHashes.length === 0) {
          router.push({ name: 'accountSetup' });
        } else {
          router.push(
            router.previousPath ? { path: router.previousPath } : { name: 'transactions' },
          );
        }
      } finally {
        buttonLoading.value = false;
        globalModalLoaderRef?.value?.close();
      }
    }
  }
};

const handleResetData = async () => {
  await resetDataLocal();

  toast.success('User data has been reset', { position: 'bottom-right' });

  inputEmailInvalid.value = false;
  inputPasswordInvalid.value = false;
  inputConfirmPasswordInvalid.value = false;

  await checkShouldRegister();

  createTooltips();
  setTooltipContent();
  isResetDataModalShown.value = false;
  user.logout();
};

/* Hooks */
onMounted(async () => {
  isPasswordStrong(inputPassword.value);
  await checkShouldRegister();
  if (shouldRegister.value) {
    createTooltips();
    setTooltipContent();
  }
});

/* Misc */
function isPasswordStrong(password: string) {
  const validationRegex = [
    { regex: /.{10,}/ }, // min 10 letters,
    // { regex: /[0-9]/ }, // numbers from 0 - 9
    // { regex: /[a-z]/ }, // letters from a - z (lowercase)
    // { regex: /[A-Z]/ }, // letters from A-Z (uppercase),
    // { regex: /[^A-Za-z0-9]/ }, // special characters
  ];

  passwordRequirements.length = validationRegex[0].regex.test(password);
  // passwordRequirements.number = validationRegex[1].regex.test(password);
  // passwordRequirements.lowercase = validationRegex[2].regex.test(password);
  // passwordRequirements.uppercase = validationRegex[3].regex.test(password);
  // passwordRequirements.special = validationRegex[4].regex.test(password);

  const isStrong = validationRegex.reduce((isStrong, item) => {
    const isValid = item.regex.test(password);
    return isStrong && isValid;
  }, true);

  return isStrong;
}

function setTooltipContent() {
  // tooltipContent.value = `
  //         <div class='d-flex flex-column align-items-start px-3'>
  //           <div class='${
  //             passwordRequirements.lowercase ? 'text-success' : 'text-danger'
  //           }'><i class='bi bi-${
  //             passwordRequirements.lowercase ? 'check' : 'x'
  //           }'></i>Lower case character</div>
  //           <div class='${
  //             passwordRequirements.uppercase ? 'text-success' : 'text-danger'
  //           }'><i class='bi bi-${
  //             passwordRequirements.uppercase ? 'check' : 'x'
  //           }'></i>Upper case character</div>
  //           <div class='${
  //             passwordRequirements.number ? 'text-success' : 'text-danger'
  //           }'><i class='bi bi-${passwordRequirements.number ? 'check' : 'x'}'></i>Have number</div>
  //           <div class='${
  //             passwordRequirements.special ? 'text-success' : 'text-danger'
  //           }'><i class='bi bi-${
  //             passwordRequirements.special ? 'check' : 'x'
  //           }'></i>Special character</div>
  //           <div class='${
  //             passwordRequirements.length ? 'text-success' : 'text-danger'
  //           }'><i class='bi bi-${
  //             passwordRequirements.length ? 'check' : 'x'
  //           }'></i>Be at least 10 characters</div>
  //         </div>
  //       `;

  tooltipContent.value = `
          <div class='d-flex flex-column align-items-start px-3' data-testid='tooltip-requirements'>
            <div class='${
              passwordRequirements.length ? 'text-success' : 'text-danger'
            }'><i class='bi bi-${
              passwordRequirements.length ? 'check' : 'x'
            }'></i>Be at least 10 characters</div>
          </div>
        `;
  const tooltipList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  Array.from(tooltipList).forEach(tooltipEl => {
    const tooltip = Tooltip.getInstance(tooltipEl);
    tooltip?.setContent({ '.tooltip-inner': tooltipContent.value });
  });
}

async function checkShouldRegister() {
  try {
    const usersCount = await getUsersCount();

    shouldRegister.value = usersCount < 2; /* 2 because the first user is the default */
  } catch {
    shouldRegister.value = true;
  }
}

/* Watchers */
watch(inputPassword, pass => {
  inputConfirmPasswordInvalid.value = false;
  if (isPasswordStrong(pass) || pass.length === 0) {
    inputPasswordInvalid.value = false;
  }
  setTooltipContent();
});
watch(inputConfirmPassword, pass => {
  if (pass.length === 0) {
    inputPasswordInvalid.value = false;
  }
});
watch(inputEmail, pass => {
  if (shouldRegister.value && (isEmail(pass) || pass.length === 0)) {
    inputEmailInvalid.value = false;
  }
});
</script>
<template>
  <div class="p-10 flex-column flex-centered flex-1 overflow-hidden">
    <div class="container-dark-border glow-dark-bg p-5">
      <h4 class="text-title text-semi-bold text-center">
        {{ shouldRegister ? 'Register' : 'Sign In' }}
      </h4>
      <p class="text-secondary text-small lh-base text-center mt-3">
        {{ shouldRegister ? 'Enter e-mail and password' : 'Enter your e-mail and password' }}
      </p>

      <form @submit="handleOnFormSubmit" class="form-login mt-5 w-100">
        <label data-testid="label-email" class="form-label">Email</label>
        <AppInput
          data-testid="input-email"
          v-model="inputEmail"
          :filled="true"
          :class="{ 'is-invalid': inputEmailInvalid }"
          placeholder="Enter email"
        />
        <div v-if="inputEmailInvalid" data-testid="invalid-text-email" class="invalid-feedback">
          Invalid e-mail.
        </div>
        <label data-testid="label-password" class="form-label mt-4">Password</label>
        <AppInput
          v-model="inputPassword"
          :filled="true"
          type="password"
          :class="{ 'is-invalid': inputPasswordInvalid }"
          placeholder="Enter password"
          :data-bs-toggle="shouldRegister ? 'tooltip' : ''"
          data-bs-animation="false"
          data-bs-placement="right"
          data-bs-custom-class="wide-xl-tooltip text-start"
          data-bs-html="true"
          data-bs-title="_"
          data-testid="input-password"
        />
        <div
          v-if="inputPasswordInvalid"
          data-testid="invalid-text-password"
          class="invalid-feedback"
        >
          Invalid password.
        </div>
        <template v-if="shouldRegister">
          <label data-testid="label-password-confirm" class="form-label mt-4"
            >Confirm password</label
          >
          <AppInput
            v-model="inputConfirmPassword"
            :filled="true"
            type="password"
            :class="{ 'is-invalid': inputConfirmPasswordInvalid }"
            placeholder="Confirm password"
            data-testid="input-password-confirm"
          />
          <div
            v-if="inputConfirmPasswordInvalid"
            data-testid="invalid-text-password-not-match"
            class="invalid-feedback"
          >
            Password do not match.
          </div>
        </template>

        <div class="flex-centered justify-content-between gap-3 mt-3">
          <div>
            <AppCheckBox
              v-model:checked="keepLoggedIn"
              name="keep_logged_in"
              label="Keep me logged in"
              data-testid="checkbox-remember"
            ></AppCheckBox>
          </div>
          <span
            v-if="!shouldRegister"
            @click="isResetDataModalShown = true"
            class="text-small link-primary cursor-pointer"
            data-testid="link-reset"
            >Reset account</span
          >
        </div>

        <div class="row justify-content-end mt-5">
          <div class="d-grid">
            <AppButton
              data-testid="button-login"
              color="primary"
              type="submit"
              class="w-100"
              :loading="buttonLoading"
              :disabled="inputEmail.length === 0 || inputPassword.length === 0"
              >{{ shouldRegister ? 'Next' : 'Sign in' }}</AppButton
            >
          </div>
        </div>
      </form>
      <AppModal v-model:show="isResetDataModalShown" class="common-modal">
        <div class="p-4">
          <i
            class="bi bi-x-lg d-inline-block cursor-pointer"
            @click="isResetDataModalShown = false"
          ></i>
          <div class="text-center">
            <AppCustomIcon :name="'bin'" style="height: 160px" />
          </div>
          <h3 class="text-center text-title text-bold">Reset Data</h3>
          <p class="text-center text-small text-secondary mt-4">
            Are you sure you want to reset the app data?
          </p>

          <hr class="separator my-5" />

          <div class="flex-between-centered gap-4">
            <AppButton
              data-testid="button-reset-cancel"
              color="borderless"
              @click="isResetDataModalShown = false"
              >Cancel</AppButton
            >
            <AppButton data-testid="button-reset" color="danger" @click="handleResetData"
              >Reset</AppButton
            >
          </div>
        </div>
      </AppModal>
    </div>
  </div>
</template>
