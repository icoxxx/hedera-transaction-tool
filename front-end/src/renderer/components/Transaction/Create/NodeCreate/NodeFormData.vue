<script setup lang="ts">
import type { NodeData } from '@renderer/utils/sdk';

import { ref } from 'vue';

import { formatAccountId } from '@renderer/utils';

import AppInput from '@renderer/components/ui/AppInput.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppTextArea from '@renderer/components/ui/AppTextArea.vue';
import KeyField from '@renderer/components/KeyField.vue';

/* Props */
const props = defineProps<{
  data: NodeData;
  required?: boolean;
}>();

/* State */
const gossipIpOrDomain = ref('');
const serviceIpOrDomain = ref('');
const gossipPort = ref('');
const servicePort = ref('');

const validIp =
  '^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]).){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$';

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: NodeData): void;
}>();

/* Handlers */
function handleAddEndpoint(key: 'gossip' | 'service') {
  const variableMapping = {
    gossip: {
      ipOrDomain: gossipIpOrDomain,
      port: gossipPort,
      endpoints: props.data.gossipEndpoints,
      key: 'gossipEndpoints',
    },
    service: {
      ipOrDomain: serviceIpOrDomain,
      port: servicePort,
      endpoints: props.data.serviceEndpoints,
      key: 'serviceEndpoints',
    },
  };

  if (!variableMapping[key].ipOrDomain.value.trim() || !variableMapping[key].port.value.trim())
    return;

  emit('update:data', {
    ...props.data,
    [variableMapping[key].key]: [
      ...variableMapping[key].endpoints,
      getEndpointData(variableMapping[key].ipOrDomain.value, variableMapping[key].port.value),
    ],
  });

  variableMapping[key].ipOrDomain.value = '';
  variableMapping[key].port.value = '';
}

function handleDeleteEndpoint(index: number, key: 'gossipEndpoints' | 'serviceEndpoints') {
  const endpoints = props.data[key];

  endpoints.splice(index, 1);
  emit('update:data', {
    ...props.data,
    [key]: endpoints,
  });
}

/* Functions */
function getEndpointData(ipOrDomain: string, port: string) {
  let ip = '';
  let domain = '';

  if (ipOrDomain.match(validIp)) {
    ip = ipOrDomain;
  } else {
    domain = ipOrDomain;
  }

  return {
    ipAddressV4: ip,
    port,
    domainName: domain.trim(),
  };
}

function formatPort(event: Event, key: 'gossip' | 'service') {
  const portMapping = {
    gossip: gossipPort,
    service: servicePort,
  };
  const target = event.target as HTMLInputElement;
  portMapping[key].value = target.value.replace(/[^0-9]/g, '');
}
</script>

<template>
  <div class="form-group mt-6" :class="['col-4 col-xxxl-3']">
    <label class="form-label"
      >Node Account ID <span v-if="required" class="text-danger">*</span></label
    >
    <AppInput
      :model-value="data.nodeAccountId?.toString()"
      @update:model-value="
        emit('update:data', {
          ...data,
          nodeAccountId: formatAccountId($event),
        })
      "
      :filled="true"
      placeholder="Enter Node Account ID"
    />
  </div>
  <div class="form-group mt-6" :class="['col-4 col-xxxl-3']">
    <label class="form-label">Node Description</label>
    <AppInput
      :model-value="data.description"
      @update:model-value="
        emit('update:data', {
          ...data,
          description: $event,
        })
      "
      :filled="true"
      placeholder="Enter Node Description"
    />
  </div>

  <hr class="separator my-5" />

  <label class="form-label"
    >Gossip Endpoints <span v-if="required" class="text-danger">*</span></label
  >
  <div class="row align-items-end">
    <div class="col-4 col-xxxl-3">
      <label class="form-label">IP/Domain</label>
      <input
        v-model="gossipIpOrDomain"
        class="form-control is-fill"
        placeholder="Enter Domain Name or IP Address"
      />
    </div>

    <div class="col-4 col-xxxl-3">
      <label class="form-label">Port</label>
      <input
        v-model="gossipPort"
        @input="formatPort($event, 'gossip')"
        class="form-control is-fill"
        placeholder="Enter Port"
      />
    </div>

    <div class="col-4 col-xxxl-3">
      <AppButton color="primary" type="button" @click="handleAddEndpoint('gossip')">
        Add Gossip Endpoint
      </AppButton>
    </div>
  </div>

  <div v-if="data.gossipEndpoints.length > 0" class="mt-5">
    <div class="row">
      <div class="col-4 col-xxxl-3">
        <label class="form-label">IP/Domain</label>
      </div>

      <div class="col-4 col-xxxl-3">
        <label class="form-label">Port</label>
      </div>

      <div class="col-4 col-xxxl-3 text-center">
        <label class="form-label">Action</label>
      </div>
    </div>

    <div class="row">
      <div class="col-12 col-xxxl-9">
        <hr class="separator mb-3" />
      </div>
    </div>

    <div v-for="(endpoint, index) of data.gossipEndpoints" :key="index" class="row py-3">
      <div class="col-4 col-xxxl-3 d-flex align-items-center text-small">
        {{ endpoint.ipAddressV4 ? endpoint.ipAddressV4 : endpoint.domainName }}
      </div>
      <div class="col-4 col-xxxl-3 d-flex align-items-center text-small">{{ endpoint.port }}</div>
      <div class="col-4 col-xxxl-3 d-flex justify-content-center">
        <AppButton
          type="button"
          color="danger"
          class="col-1"
          @click="handleDeleteEndpoint(index, 'gossipEndpoints')"
          >Delete
        </AppButton>
      </div>
    </div>
  </div>

  <hr class="separator my-5" />

  <label class="form-label"
    >Service Endpoints <span v-if="required" class="text-danger">*</span></label
  >
  <div class="row align-items-end">
    <div class="col-4 col-xxxl-3">
      <label class="form-label">IP/Domain</label>
      <input
        v-model="serviceIpOrDomain"
        class="form-control is-fill"
        placeholder="Enter Domain Name or IP Address"
      />
    </div>

    <div class="col-4 col-xxxl-3">
      <label class="form-label">Port</label>
      <input
        v-model="servicePort"
        @input="formatPort($event, 'service')"
        class="form-control is-fill"
        placeholder="Enter Port"
      />
    </div>

    <div class="col-4 col-xxxl-3">
      <AppButton color="primary" type="button" @click="handleAddEndpoint('service')"
        >Add Service Endpoint
      </AppButton>
    </div>
  </div>

  <div v-if="data.serviceEndpoints.length > 0" class="mt-5">
    <div class="row">
      <div class="col-4 col-xxxl-3">
        <label class="form-label">IP/Domain</label>
      </div>
      <div class="col-4 col-xxxl-3">
        <label class="form-label">Port</label>
      </div>
      <div class="col-4 col-xxxl-3 text-center">
        <label class="form-label">Action</label>
      </div>
    </div>

    <div class="row">
      <div class="col-12 col-xxxl-9">
        <hr class="separator mb-3" />
      </div>
    </div>

    <div v-for="(endpoint, index) of data.serviceEndpoints" :key="index" class="row py-3">
      <div class="col-4 col-xxxl-3 d-flex align-items-center text-small">
        {{ endpoint.ipAddressV4 ? endpoint.ipAddressV4 : endpoint.domainName }}
      </div>
      <div class="col-4 col-xxxl-3 d-flex align-items-center text-small">{{ endpoint.port }}</div>
      <div class="col-4 col-xxxl-3 d-flex justify-content-center">
        <AppButton
          type="button"
          color="danger"
          class="col-1"
          @click="handleDeleteEndpoint(index, 'serviceEndpoints')"
          >Delete
        </AppButton>
      </div>
    </div>
  </div>

  <hr class="separator my-5" />

  <div class="form-group" :class="['col-8 col-xxxl-6']">
    <label class="form-label"
      >Gossip CA Certificate <span v-if="required" class="text-danger">*</span></label
    >
    <AppTextArea
      :model-value="data.gossipCaCertificate"
      @update:model-value="
        emit('update:data', {
          ...data,
          gossipCaCertificate: $event.startsWith('0x') ? $event.slice(2) : $event,
        })
      "
      :filled="true"
      placeholder="Enter Gossip CA Certificate"
    />
  </div>

  <div class="form-group mt-6" :class="['col-8 col-xxxl-6']">
    <label class="form-label">GRPC Certificate Hash</label>
    <AppTextArea
      :model-value="data.certificateHash"
      @update:model-value="
        emit('update:data', {
          ...data,
          certificateHash: $event,
        })
      "
      :filled="true"
      placeholder="Enter GRPC Certificate Hash"
    />
  </div>

  <hr class="separator my-5" />

  <div class="form-group col-8 col-xxxl-6">
    <KeyField
      label="Admin Key"
      :model-key="data.adminKey"
      @update:model-key="
        emit('update:data', {
          ...data,
          adminKey: $event,
        })
      "
      :is-required="required"
    />
  </div>
</template>
