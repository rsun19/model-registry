import * as React from 'react';
import { FetchStateObject, NotReadyError, useFetchState } from 'mod-arch-shared';
import { listModelRegistryCertificateNames } from '~/app/api/k8s';
import { ListConfigSecretsResponse } from '~/app/shared/components/types';

const useModelRegistryCertificateNames = (
  isDisabled?: boolean,
): FetchStateObject<ListConfigSecretsResponse> => {
  const fetchData = React.useCallback(() => {
    if (isDisabled) {
      return Promise.reject(new NotReadyError('Model registry certificate names is disabled'));
    }

    return listModelRegistryCertificateNames('')({});
  }, [isDisabled]);

  const [data, loaded, error, refresh] = useFetchState<ListConfigSecretsResponse>(fetchData, {
    secrets: [],
    configMaps: [],
  });

  return { data, loaded, error, refresh };
};

export default useModelRegistryCertificateNames;
