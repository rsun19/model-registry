import * as React from 'react';
import {
  Button,
  Form,
  FormGroup,
  HelperText,
  HelperTextItem,
  TextInput,
  Alert,
  Modal,
  ModalVariant,
  ModalFooter,
  ModalHeader,
  ModalBody,
  Bullseye,
  Checkbox,
  Spinner,
} from '@patternfly/react-core';
import { DatabaseType, FormSection, ModelRegistryKind, RecursivePartial } from 'mod-arch-shared';
import { createModelRegistrySettings, patchModelRegistrySettings } from '~/app/api/k8s';
import ModelRegistryDatabasePassword from '~/app/pages/settings/ModelRegistryDatabasePassword';
import K8sNameDescriptionField, {
  useK8sNameDescriptionFieldData,
} from '~/concepts/k8s/K8sNameDescriptionField/K8sNameDescriptionField';
import ThemeAwareFormGroupWrapper from '~/app/pages/settings/components/ThemeAwareFormGroupWrapper';
import { BFF_API_VERSION } from '~/app/utilities/const';
import { isValidK8sName, translateDisplayNameForK8s } from '~/app/shared/components/utils';
import { SecureDBRType, ResourceType } from './const';
import { CreateMRSecureDBSection, SecureDBInfo } from './CreateMRSecureDBSection';
import { constructRequestBody, findConfigMap } from './utils';
import useModelRegistryCertificateNames from '../modelRegistrySettings/useModelRegistryCertificateNames';

type CreateModalProps = {
  onClose: () => void;
  refresh: () => void;
  modelRegistry?: ModelRegistryKind;
};

const CreateModal: React.FC<CreateModalProps> = ({ onClose, refresh, modelRegistry: mr }) => {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<Error>();
  const { data: nameDesc, onDataChange: setNameDesc } = useK8sNameDescriptionFieldData({
    initialData: mr,
  });
  const [host, setHost] = React.useState('');
  const [port, setPort] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [database, setDatabase] = React.useState('');
  const [addSecureDB, setAddSecureDB] = React.useState(false);
  const [isHostTouched, setIsHostTouched] = React.useState(false);
  const [isPortTouched, setIsPortTouched] = React.useState(false);
  const [isUsernameTouched, setIsUsernameTouched] = React.useState(false);
  const [isPasswordTouched, setIsPasswordTouched] = React.useState(false);
  const [isDatabaseTouched, setIsDatabaseTouched] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const {
    data: configSecrets,
    loaded: configSecretsLoaded,
    error: configSecretsError,
  } = useModelRegistryCertificateNames(!addSecureDB);
  const modelRegistryNamespace = 'kubeflow';
  const [secureDBInfo, setSecureDBInfo] = React.useState<SecureDBInfo>({
    type: SecureDBRType.EXISTING,
    nameSpace: '',
    resourceName: '',
    certificate: '',
    key: '',
    isValid: true,
  });

  React.useEffect(() => {
    if (configSecretsLoaded && !configSecretsError && !mr) {
      setSecureDBInfo((prev) => ({
        ...prev,
        type: SecureDBRType.EXISTING,
        isValid: true,
      }));
    }
  }, [configSecretsLoaded, configSecretsError, mr]);

  React.useEffect(() => {
    if (mr) {
      const dbSpec = mr.databaseConfig;
      setHost(dbSpec.host);
      setPort(dbSpec.port.toString());
      setUsername(dbSpec.username);
      setDatabase(dbSpec.database);
      const certificateResourceRef =
        mr.databaseConfig.sslRootCertificateConfigMap || mr.databaseConfig.sslRootCertificateSecret;
      if (certificateResourceRef) {
        setAddSecureDB(true);
        const existingInfo = {
          type: SecureDBRType.EXISTING,
          nameSpace: '',
          key: certificateResourceRef.key,
          resourceName: certificateResourceRef.name,
          resourceType: mr.databaseConfig.sslRootCertificateSecret
            ? ResourceType.Secret
            : ResourceType.ConfigMap,
          certificate: '',
        };
        setSecureDBInfo({ ...existingInfo, isValid: true });
      }
    }
  }, [mr]);

  // if (!modelRegistryNamespace) {
  //   return (
  //     <ApplicationsPage loaded empty={false}>
  //       <RedirectErrorState
  //         title="Could not load component state"
  //         errorMessage="No registries namespace could be found"
  //       />
  //     </ApplicationsPage>
  //   );
  // }

  const onBeforeClose = () => {
    setError(undefined);
    setHost('');
    setPort('');
    setUsername('');
    setPassword('');
    setDatabase('');
    setIsHostTouched(false);
    setIsPortTouched(false);
    setIsUsernameTouched(false);
    setIsPasswordTouched(false);
    setIsDatabaseTouched(false);
    setShowPassword(false);
    onClose();
  };

  const hasContent = (value: string): boolean => !!value.trim().length;

  const canSubmit = () =>
    !isSubmitting &&
    isValidK8sName(nameDesc.k8sName.value || translateDisplayNameForK8s(nameDesc.name)) &&
    hasContent(nameDesc.name) &&
    hasContent(host) &&
    hasContent(password) &&
    hasContent(port) &&
    hasContent(username) &&
    hasContent(database) &&
    (!addSecureDB || (secureDBInfo.isValid && !configSecretsError));

  const onSubmit = async () => {
    setIsSubmitting(true);
    setError(undefined);

    const newDatabaseCACertificate =
      addSecureDB && secureDBInfo.type === SecureDBRType.NEW ? secureDBInfo.certificate : undefined;

    if (mr) {
      const data: RecursivePartial<ModelRegistryKind> = {
        metadata: {
          annotations: {
            'openshift.io/description': nameDesc.description,
            'openshift.io/display-name': nameDesc.name.trim(),
          },
        },
        databaseConfig: {
          host,
          port: Number(port),
          database,
          username,
        },
      };
      try {
        await patchModelRegistrySettings('')(
          {},
          {
            modelRegistry: constructRequestBody(data, secureDBInfo, addSecureDB),
            databasePassword: password,
            newDatabaseCACertificate,
          },
          mr.metadata.name,
        );
        refresh();
        onBeforeClose();
      } catch (e) {
        if (e instanceof Error) {
          setError(e);
        }
        setIsSubmitting(false);
      }
    } else {
      const data: Omit<ModelRegistryKind, 'spec'> = {
        apiVersion: BFF_API_VERSION,
        kind: 'ModelRegistry',
        metadata: {
          name: nameDesc.k8sName.value || translateDisplayNameForK8s(nameDesc.name),
          namespace: 'model-registry',
          annotations: {
            'openshift.io/description': nameDesc.description,
            'openshift.io/display-name': nameDesc.name.trim(),
          },
        },
        databaseConfig: {
          host,
          port: Number(port),
          database,
          username,
          databaseType: DatabaseType.MySQL,
          skipDBCreation: false,
        },
      };

      if (addSecureDB && secureDBInfo.resourceType === ResourceType.Secret) {
        data.databaseConfig.sslRootCertificateSecret = {
          name: secureDBInfo.resourceName,
          key: secureDBInfo.key,
        };
      } else if (addSecureDB) {
        data.databaseConfig.sslRootCertificateConfigMap = findConfigMap(secureDBInfo);
      }

      try {
        await createModelRegistrySettings('')(
          {},
          {
            modelRegistry: data,
            databasePassword: password,
            newDatabaseCACertificate,
          },
        );
        refresh();
        onBeforeClose();
      } catch (e) {
        if (e instanceof Error) {
          setError(e);
        }
        setIsSubmitting(false);
      }
    }
  };

  const hostInput = (
    <TextInput
      isRequired
      type="text"
      id="mr-host"
      name="mr-host"
      value={host}
      onBlur={() => setIsHostTouched(true)}
      onChange={(_e, value) => setHost(value)}
    />
  );

  const hostHelperText = isHostTouched && !hasContent(host) && (
    <HelperText>
      <HelperTextItem variant="error" data-testid="mr-host-error">
        Host cannot be empty
      </HelperTextItem>
    </HelperText>
  );

  const portInput = (
    <TextInput
      isRequired
      type="text"
      id="mr-port"
      name="mr-port"
      value={port}
      onBlur={() => setIsPortTouched(true)}
      onChange={(_e, value) => setPort(value)}
    />
  );

  const portHelperText = isPortTouched && !hasContent(port) && (
    <HelperText>
      <HelperTextItem variant="error" data-testid="mr-port-error">
        Port cannot be empty
      </HelperTextItem>
    </HelperText>
  );

  const userNameInput = (
    <TextInput
      isRequired
      type="text"
      id="mr-username"
      name="mr-username"
      value={username}
      onBlur={() => setIsUsernameTouched(true)}
      onChange={(_e, value) => setUsername(value)}
    />
  );

  const usernameHelperText = isUsernameTouched && !hasContent(username) && (
    <HelperText>
      <HelperTextItem variant="error" data-testid="mr-username-error">
        Username cannot be empty
      </HelperTextItem>
    </HelperText>
  );

  const passwordInput = (
    <ModelRegistryDatabasePassword
      password={password || ''}
      setPassword={setPassword}
      isPasswordTouched={isPasswordTouched}
      setIsPasswordTouched={setIsPasswordTouched}
      showPassword={showPassword}
    />
  );

  const passwordHelperText = isPasswordTouched && !hasContent(password) && (
    <HelperText>
      <HelperTextItem variant="error" data-testid="mr-password-error">
        Password cannot be empty
      </HelperTextItem>
    </HelperText>
  );

  const databaseInput = (
    <TextInput
      isRequired
      type="text"
      id="mr-database"
      name="mr-database"
      value={database}
      onBlur={() => setIsDatabaseTouched(true)}
      onChange={(_e, value) => setDatabase(value)}
    />
  );

  const databaseHelperText = isDatabaseTouched && !hasContent(database) && (
    <HelperText>
      <HelperTextItem variant="error" data-testid="mr-database-error">
        Database cannot be empty
      </HelperTextItem>
    </HelperText>
  );

  return (
    <Modal
      isOpen
      variant={ModalVariant.medium}
      onClose={onBeforeClose}
      data-testid="create-model-registry-modal"
    >
      <ModalHeader title="Create model registry" />
      <ModalBody>
        <Form>
          <K8sNameDescriptionField dataTestId="mr" data={nameDesc} onDataChange={setNameDesc} />
          <FormSection
            title="Connect to external MySQL database"
            description="This external database is where model data is stored."
          >
            <ThemeAwareFormGroupWrapper
              label="Host"
              fieldId="mr-host"
              isRequired
              helperTextNode={hostHelperText}
            >
              {hostInput}
            </ThemeAwareFormGroupWrapper>

            <ThemeAwareFormGroupWrapper
              label="Port"
              fieldId="mr-port"
              isRequired
              helperTextNode={portHelperText}
            >
              {portInput}
            </ThemeAwareFormGroupWrapper>

            <ThemeAwareFormGroupWrapper
              label="Username"
              fieldId="mr-username"
              isRequired
              helperTextNode={usernameHelperText}
            >
              {userNameInput}
            </ThemeAwareFormGroupWrapper>

            <ThemeAwareFormGroupWrapper
              label="Password"
              fieldId="mr-password"
              isRequired
              helperTextNode={passwordHelperText}
            >
              {passwordInput}
            </ThemeAwareFormGroupWrapper>

            <ThemeAwareFormGroupWrapper
              label="Database"
              fieldId="mr-database"
              isRequired
              helperTextNode={databaseHelperText}
            >
              {databaseInput}
            </ThemeAwareFormGroupWrapper>

            {/* ... Optional TLS section ... */}

            <>
              <FormGroup>
                <Checkbox
                  label="Add CA certificate to secure database connection"
                  isChecked={addSecureDB}
                  onChange={(_e, value) => setAddSecureDB(value)}
                  id="add-secure-db"
                  data-testid="add-secure-db-mr-checkbox"
                  name="add-secure-db"
                />
              </FormGroup>
              {addSecureDB &&
                (!configSecretsLoaded && !configSecretsError ? (
                  <Bullseye>
                    <Spinner className="pf-v6-u-m-md" />
                  </Bullseye>
                ) : configSecretsLoaded ? (
                  <CreateMRSecureDBSection
                    secureDBInfo={secureDBInfo}
                    modelRegistryNamespace={modelRegistryNamespace}
                    k8sName={nameDesc.k8sName.value}
                    existingCertConfigMaps={configSecrets.configMaps}
                    existingCertSecrets={configSecrets.secrets}
                    setSecureDBInfo={setSecureDBInfo}
                  />
                ) : (
                  <Alert
                    isInline
                    variant="danger"
                    title="Error fetching config maps and secrets"
                    data-testid="error-fetching-resource-alert"
                  >
                    {configSecretsError?.message}
                  </Alert>
                ))}
            </>
          </FormSection>

          {error && (
            <FormGroup>
              <Alert variant="danger" isInline title={error.message} data-testid="mr-error" />
            </FormGroup>
          )}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button key="create-button" variant="primary" isDisabled={!canSubmit()} onClick={onSubmit}>
          Create
        </Button>
        <Button key="cancel-button" variant="secondary" onClick={onBeforeClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default CreateModal;
