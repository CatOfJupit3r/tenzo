import { useLiveQuery } from '@tanstack/react-db';
import { useCallback, useMemo } from 'react';

import { fieldTemplatesCollection } from '../collections/field-templates.collection';
import { BUILT_IN_FIELD_TEMPLATES } from '../constants/default-field-templates';
import { createStoredFieldTemplate, sanitizeTemplateFieldKeys } from '../lib/field-templates';
import type {
  iCreateStoredFieldTemplateInput,
  iFieldTemplateViewModel,
  iStoredFieldTemplate,
  TemplateFieldKey,
} from '../lib/field-templates';

export type FieldTemplatePatch = Partial<Omit<iStoredFieldTemplate, 'id' | 'createdAt' | 'updatedAt'>>;

export function useFieldTemplates() {
  const { data: storedTemplates } = useLiveQuery((query) =>
    query.from({ template: fieldTemplatesCollection }).orderBy(({ template }) => template.name, 'asc'),
  );

  const fieldTemplates = useMemo<iFieldTemplateViewModel[]>(
    () => [...BUILT_IN_FIELD_TEMPLATES, ...storedTemplates.map((template) => ({ ...template, isBuiltIn: false }))],
    [storedTemplates],
  );

  const getFieldTemplateById = useCallback(
    (id: string | null) => (id ? (fieldTemplates.find((template) => template.id === id) ?? null) : null),
    [fieldTemplates],
  );

  const getTemplatesForField = useCallback(
    (fieldKey: TemplateFieldKey) => fieldTemplates.filter((template) => template.fieldKeys.includes(fieldKey)),
    [fieldTemplates],
  );

  const addFieldTemplate = useCallback((input: iCreateStoredFieldTemplateInput) => {
    const template = createStoredFieldTemplate(input);
    fieldTemplatesCollection.insert(template);
    return template.id;
  }, []);

  const updateFieldTemplate = useCallback((id: string, patch: FieldTemplatePatch) => {
    if (!fieldTemplatesCollection.has(id)) {
      return;
    }

    fieldTemplatesCollection.update(id, (draft) => {
      if (patch.name !== undefined) {
        draft.name = patch.name;
      }

      if (patch.description !== undefined) {
        draft.description = patch.description;
      }

      if (patch.mode !== undefined) {
        draft.mode = patch.mode;
      }

      if (patch.fieldKeys !== undefined) {
        draft.fieldKeys = sanitizeTemplateFieldKeys(patch.fieldKeys);
      }

      if (patch.content !== undefined) {
        draft.content = patch.content;
      }

      draft.updatedAt = new Date().toISOString();
    });
  }, []);

  const removeFieldTemplate = useCallback((id: string) => {
    if (fieldTemplatesCollection.has(id)) {
      fieldTemplatesCollection.delete(id);
    }
  }, []);

  const duplicateFieldTemplate = useCallback(
    (id: string) => {
      const sourceTemplate = fieldTemplates.find((template) => template.id === id);

      if (!sourceTemplate) {
        return null;
      }

      return addFieldTemplate({
        name: `${sourceTemplate.name} (copy)`,
        description: sourceTemplate.description,
        mode: sourceTemplate.mode,
        fieldKeys: sourceTemplate.fieldKeys,
        content: sourceTemplate.content,
      });
    },
    [addFieldTemplate, fieldTemplates],
  );

  return {
    fieldTemplates,
    getFieldTemplateById,
    getTemplatesForField,
    addFieldTemplate,
    updateFieldTemplate,
    removeFieldTemplate,
    duplicateFieldTemplate,
  };
}
