<script setup lang="ts">
import axios from 'axios';
import { onBeforeMount, ref } from 'vue';

import useNetworkStore from '@renderer/stores/storeNetwork';

// import AppButton from '@renderer/components/ui/AppButton.vue';

interface ITransaction {
  transaction_id: string;
  consensus_timestamp: string;
  name: string;
  result: string;
  transaction_hash: string;
  entity_id: string;
}

const networkStore = useNetworkStore();

const transactionsFetched = ref<ITransaction[]>([]);
const isLoading = ref(false);

onBeforeMount(async () => {
  isLoading.value = true;
  try {
    const {
      data: { transactions },
    } = await axios.get(`${networkStore.mirrorNodeBaseURL}/transactions`);
    transactionsFetched.value = transactions;
  } catch (error) {
    console.log('error', error);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="p-5">
    <h1 class="text-title text-bold">Tokens</h1>
    <!-- <p v-show="isLoading">Loading...</p>
    <div v-if="transactionsFetched.length > 0">
      <div
        v-for="(item, index) in transactionsFetched"
        :key="index"
        class="rounded bg-dark-blue-800 p-4 overflow-hidden"
        :class="{ 'mt-4': index !== 0 }"
      >
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <p class="text-main d-flex align-items-center">
              <i
                v-if="item.type === 'send'"
                class="bi bi-arrow-up-right me-3 text-info text-title fw-bolder"
              ></i>
              <i
                v-else-if="item.type === 'receive'"
                class="bi bi-arrow-down-left me-3 text-success text-title fw-bold"
              ></i>
              {{ item.transaction_hash }}
            </p>
            <p class="text-micro mt-3">{{ item.entity_id }}</p>
          </div>
          <div>
            <div class="d-flex justify-content-end align-items-center">
              <AppButton color="primary" outline class="me-3">Details</AppButton>
              <AppButton color="primary">Sign</AppButton>
            </div>
          </div>
        </div>

        <div class="mt-4 d-inline-flex align-items-center">
          <span class="text-micro me-4">Approvers</span>
          <span
            v-for="(approver, index) in item.approvers"
            :key="index"
            class="badge bg-dark-blue-700 d-inline-flex align-items-center fw-normal"
            :class="{ 'me-2': index !== item.approvers.length }"
            ><i class="bi bi-check-lg text-success text-subheader lh-1 me-1"></i
            >{{ approver }}</span
          >
        </div>
      </div>
    </div>
    <div v-else>No transactions found</div> -->
  </div>
</template>
