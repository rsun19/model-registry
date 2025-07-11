export const CA_BUNDLE_CRT = 'ca-bundle.crt';
export const ODH_TRUSTED_BUNDLE = 'odh-trusted-ca-bundle';
export const ODH_CA_BUNDLE_CRT = 'odh-ca-bundle.crt';
export const ODH_PRODUCT_NAME = 'OpenShift AI';

export enum SecureDBRType {
  EXISTING = 'existing',
  NEW = 'new',
  CLUSTER_WIDE = 'cluster-wide',
  OPENSHIFT = 'openshift',
}

export enum ResourceType {
  ConfigMap = 'ConfigMap',
  Secret = 'Secret',
}
