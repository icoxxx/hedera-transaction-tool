import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { Client, Timestamp } from '@hashgraph/sdk';

import { NetworkExchangeRateSetResponse } from '@main/shared/interfaces';

import { getExchangeRateSet } from '@renderer/services/mirrorNodeDataService';
import { setClient } from '@renderer/services/transactionService';

import { getNodeNumbersFromNetwork } from '@renderer/utils';

export type Network = 'mainnet' | 'testnet' | 'previewnet' | 'custom';
export type CustomNetworkSettings = {
  nodeAccountIds: {
    [key: string]: string;
  };
  mirrorNodeGRPCEndpoint: string;
  mirrorNodeRESTAPIEndpoint: string;
};

const useNetworkStore = defineStore('network', () => {
  /* State */
  const network = ref<Network>('testnet');
  const customNetworkSettings = ref<CustomNetworkSettings | null>(null);
  const exchangeRateSet = ref<NetworkExchangeRateSetResponse | null>(null);

  /* Getters */
  const mirrorNodeBaseURL = computed(() => getMirrorNodeLinkByNetwork(network.value));

  const client = computed(() => {
    switch (network.value) {
      case 'mainnet':
        return Client.forMainnet();
      case 'testnet':
        return Client.forTestnet();
      case 'previewnet':
        return Client.forPreviewnet();
      case 'custom':
        if (customNetworkSettings.value) {
          return Client.forNetwork(customNetworkSettings.value.nodeAccountIds).setMirrorNetwork(
            customNetworkSettings.value.mirrorNodeGRPCEndpoint,
          );
        }
        throw Error('Settings for custom network are required');
      default:
        throw Error('Network not supported');
    }
  });

  const currentRate = computed(() => {
    if (!exchangeRateSet.value) {
      throw new Error('Exchange rate set not found');
    }

    const timestamp = Timestamp.generate().seconds.low;

    const networkCurrRate = exchangeRateSet.value.current_rate;
    let rate = networkCurrRate.cent_equivalent / networkCurrRate.hbar_equivalent / 100;

    const networkNextRate = exchangeRateSet.value.next_rate;

    if (timestamp > networkCurrRate.expiration_time) {
      rate = networkNextRate.cent_equivalent / networkNextRate.hbar_equivalent / 100;
    }

    if (timestamp > networkNextRate.expiration_time) {
      throw new Error('Exchange rate expired');
    }

    return rate;
  });

  const nodeNumbers = computed(() => {
    return getNodeNumbersFromNetwork(client.value.network);
  });

  /* Actions */
  async function setNetwork(newNetwork: Network, _customNetworkSettings?: CustomNetworkSettings) {
    if (newNetwork === 'custom') {
      if (!_customNetworkSettings) {
        throw Error('Settings for custom network are required');
      }
      customNetworkSettings.value = _customNetworkSettings;
      await setClient(newNetwork, _customNetworkSettings.nodeAccountIds, [
        _customNetworkSettings.mirrorNodeGRPCEndpoint,
      ]);
    } else {
      await setClient(newNetwork);
    }

    network.value = newNetwork;

    exchangeRateSet.value = await getExchangeRateSet(mirrorNodeBaseURL.value);
  }

  /* Helpers */
  function getMirrorNodeLinkByNetwork(network: Network) {
    switch (network) {
      case 'mainnet':
      case 'testnet':
      case 'previewnet':
        return `https://${network}.mirrornode.hedera.com/api/v1`;
      case 'custom':
        if (customNetworkSettings.value) {
          return customNetworkSettings.value?.mirrorNodeRESTAPIEndpoint;
        }
        throw Error('Settings for custom network are required');
      default:
        throw Error('Invalid network');
    }
  }

  return {
    network,
    customNetworkSettings,
    exchangeRateSet,
    mirrorNodeBaseURL,
    client,
    currentRate,
    nodeNumbers,
    setNetwork,
    getMirrorNodeLinkByNetwork,
  };
});

export default useNetworkStore;
