import { Router } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';

import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

export function addGuards(router: Router) {
  const user = useUserStore();

  router.beforeEach(to => {
    const userIsLoggedIn = user.personal?.isLoggedIn;

    if (
      (!userIsLoggedIn && to.name === 'accountSetup') ||
      (userIsLoggedIn && to.name === 'login') ||
      (!user.shouldSetupAccount && to.name === 'accountSetup') ||
      (isLoggedInOrganization(user.selectedOrganization) && to.name === 'organizationLogin')
    ) {
      return router.previousPath ? { path: router.previousPath } : { name: 'transactions' };
    }

    if (to.name !== 'login' && to.name !== 'organizationLogin' && to.name !== 'accountSetup') {
      router.previousPath = to.path;
    }

    if (!to.meta.withoutAuth && userIsLoggedIn === false) {
      router.push({ name: 'login' });
    }

    return true;
  });
}
