<script setup lang="ts">
import type { USER_PASSWORD_MODAL_TYPE } from '@renderer/providers';

import { computed, inject, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

import { hashData } from '@renderer/services/electronUtilsService';

import { getKeysFromSecretHash, isUserLoggedIn } from '@renderer/utils';

import { USER_PASSWORD_MODAL_KEY } from '@renderer/providers';

import DecryptKeyModal from '@renderer/components/KeyPair/ImportEncrypted/components/DecryptKeyModal.vue';

/* Props */
defineProps<{
  defaultPassword?: string;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'end', storedCount: number): void;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();

/* Injected */
const userPasswordModalRef = inject<USER_PASSWORD_MODAL_TYPE>(USER_PASSWORD_MODAL_KEY);

/* State */
const isDecryptKeyModalShown = ref(false);

const allKeyPaths = ref<string[]>([]);
const mnemonic = ref<string[] | null>(null);
const mnemomicHash = ref<string | null>(null);
const indexesFromMnemonic = ref<number[]>([]);
const storedCount = ref(0);

const currentKeyPath = ref<string | null>(null);

/* Computed */
const currentIndex = computed(() => {
  if (!currentKeyPath.value) return -1;
  return allKeyPaths.value.indexOf(currentKeyPath.value);
});

/* Handlers */
const handleSkipAll = () => end();
const handleSkipOne = () => nextKey();
const handleStored = () => {
  storedCount.value++;
  nextKey();
};

/* Functions */
async function process(keyPaths: string[], words: string[] | null) {
  reset();

  allKeyPaths.value = keyPaths;
  mnemonic.value = words;
  mnemomicHash.value = words ? await hashData(words.toString()) : null;

  if (words) {
    indexesFromMnemonic.value = (await getKeysFromSecretHash(user.keyPairs, words)).map(
      key => key.index,
    );
  }

  /* Verify user is logged in with password */
  if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');
  const personalPassword = user.getPassword();
  if (!personalPassword && !user.personal.useKeychain) {
    if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
    userPasswordModalRef.value?.open(
      'Enter personal password',
      'Private key/s will be encrypted with this password',
      nextKey,
    );
    return;
  }

  await nextKey();
}

async function nextKey() {
  const next = allKeyPaths.value[currentIndex.value + 1] || null;

  if (!next) {
    await end();
  } else {
    currentKeyPath.value = next;
    if (!isDecryptKeyModalShown.value) isDecryptKeyModalShown.value = true;
  }
}

async function end() {
  emit('end', storedCount.value);

  isDecryptKeyModalShown.value = false;

  if (storedCount.value > 0) {
    toast.success('Keys imported successfully', { position: 'bottom-right' });
  }

  await user.refetchKeys();
  user.refetchAccounts();
  await user.refetchUserState();
}

function reset() {
  currentKeyPath.value = null;
}

/* Expose */
defineExpose({ process });
</script>
<template>
  <div>
    <DecryptKeyModal
      v-if="isDecryptKeyModalShown"
      v-model:show="isDecryptKeyModalShown"
      :key-path="currentKeyPath"
      :keys-left="allKeyPaths.length - currentIndex - 1"
      :mnemonic="mnemonic"
      :mnemonic-hash="mnemomicHash"
      :indexes-from-mnemonic="indexesFromMnemonic"
      :default-password="defaultPassword"
      @skip:all="handleSkipAll"
      @skip:one="handleSkipOne"
      @stored="handleStored"
    />
  </div>
</template>
