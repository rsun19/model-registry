import { K8sResourceCommon, RecursivePartial } from 'mod-arch-shared';
import * as _ from 'lodash-es';
import {
  isK8sDSGResource,
  getDisplayNameFromK8sResource,
  getDescriptionFromK8sResource,
  translateDisplayNameForK8s,
  isValidK8sName,
} from '~/app/shared/components/utils';
import {
  MAX_PVC_NAME_LENGTH,
  MAX_RESOURCE_NAME_LENGTH,
  ROUTE_BASED_NAME_LENGTH,
} from '~/app/utilities/const';
import {
  UseK8sNameDescriptionDataConfiguration,
  K8sNameDescriptionFieldData,
  K8sNameDescriptionType,
  LimitNameResourceType,
  K8sNameDescriptionFieldUpdateFunctionInternal,
} from './types';

export const resourceTypeLimits: Record<LimitNameResourceType, number> = {
  [LimitNameResourceType.PROJECT]: ROUTE_BASED_NAME_LENGTH,
  [LimitNameResourceType.WORKBENCH]: ROUTE_BASED_NAME_LENGTH,
  [LimitNameResourceType.PVC]: MAX_PVC_NAME_LENGTH,
};

export const setupDefaults = ({
  initialData,
  limitNameResourceType,
  safePrefix,
  staticPrefix,
  regexp,
  invalidCharsMessage,
  editableK8sName,
}: UseK8sNameDescriptionDataConfiguration): K8sNameDescriptionFieldData => {
  let initialName = '';
  let initialDescription = '';
  let initialK8sNameValue = '';
  let configuredMaxLength = MAX_RESOURCE_NAME_LENGTH;

  if (isK8sNameDescriptionType(initialData)) {
    initialName = initialData.name || '';
    initialDescription = initialData.description || '';
    initialK8sNameValue = initialData.k8sName || '';
  } else if (isK8sDSGResource(initialData)) {
    initialName = getDisplayNameFromK8sResource(initialData);
    initialDescription = getDescriptionFromK8sResource(initialData);
    initialK8sNameValue = initialData.metadata.name;
  }

  if (limitNameResourceType != null) {
    configuredMaxLength = resourceTypeLimits[limitNameResourceType];
  }

  return handleUpdateLogic({
    name: initialName,
    description: initialDescription,
    k8sName: {
      value: initialK8sNameValue,
      state: {
        immutable: !editableK8sName && initialK8sNameValue !== '',
        invalidCharacters: false,
        invalidLength: false,
        maxLength: configuredMaxLength,
        safePrefix,
        staticPrefix,
        regexp,
        invalidCharsMessage,
        touched:
          !!editableK8sName &&
          initialK8sNameValue !== '' &&
          initialK8sNameValue !== translateDisplayNameForK8s(initialName),
      },
    },
  })('name', initialName) satisfies K8sNameDescriptionFieldData;
};

export const isK8sNameDescriptionType = (
  x?: K8sNameDescriptionType | K8sResourceCommon,
): x is K8sNameDescriptionType => !!x && 'k8sName' in x;

export const handleUpdateLogic =
  (existingData: K8sNameDescriptionFieldData): K8sNameDescriptionFieldUpdateFunctionInternal =>
  (key, value) => {
    const changedData: RecursivePartial<K8sNameDescriptionFieldData> = {};

    // Handle special cases
    switch (key) {
      case 'name': {
        changedData.name = value;

        const { touched, immutable, maxLength, safePrefix, staticPrefix } =
          existingData.k8sName.state;
        // When name changes, we want to update resource name if applicable
        if (!touched && !immutable) {
          // Update the generated name
          const k8sValue = translateDisplayNameForK8s(value, {
            maxLength,
            safeK8sPrefix: safePrefix,
            staticPrefix,
          });
          changedData.k8sName = {
            value: k8sValue,
          };
        }
        break;
      }
      case 'k8sName':
        changedData.k8sName = {
          state: {
            invalidCharacters:
              value.length > 0 ? !isValidK8sName(value, existingData.k8sName.state.regexp) : false,
            invalidLength: value.length > existingData.k8sName.state.maxLength,
            touched: true,
          },
          value,
        };
        break;
      default:
        // Do nothing special
        changedData[key] = value;
    }

    return _.merge({}, existingData, changedData);
  };
