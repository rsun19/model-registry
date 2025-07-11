import { ModelRegistryKind, RecursivePartial } from 'mod-arch-shared';
import { SecureDBInfo } from './CreateMRSecureDBSection';
import { ResourceType } from './const';

export const findConfigMap = (secureDBInfo: SecureDBInfo): { name: string; key: string } => ({
  name: secureDBInfo.resourceName,
  key: secureDBInfo.key,
});

export const constructRequestBody = (
  data: RecursivePartial<ModelRegistryKind>,
  secureDBInfo: SecureDBInfo,
  addSecureDB: boolean,
): RecursivePartial<ModelRegistryKind> => {
  const mr = data;

  // Initialize databaseConfig if it doesn't exist
  if (!mr.databaseConfig) {
    mr.databaseConfig = {};
  }

  if (addSecureDB && secureDBInfo.resourceType === ResourceType.Secret) {
    mr.databaseConfig.sslRootCertificateSecret = {
      name: secureDBInfo.resourceName,
      key: secureDBInfo.key,
      match: {},
      replaceAll: {},
      test: {}
    };
    mr.databaseConfig.sslRootCertificateConfigMap = undefined;
  } else if (addSecureDB) {
    mr.databaseConfig.sslRootCertificateConfigMap = findConfigMap(secureDBInfo);
    mr.databaseConfig.sslRootCertificateSecret = undefined;
  } else {
    mr.databaseConfig.sslRootCertificateConfigMap = undefined;
    mr.databaseConfig.sslRootCertificateSecret = undefined;
  }

  return mr;
};
