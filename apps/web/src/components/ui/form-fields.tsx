import { useStore } from '@tanstack/react-form';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

import { Button } from './button';
import type { iButtonProps } from './button';
// eslint-disable-next-line import-x/no-cycle
import { useFieldContext, FieldError, useFormContext, FieldDescription, FieldLabel } from './field';
import { Input } from './input';
import { SingleSelect } from './select';
import type { iSingleSelectProps } from './select';
import { Textarea } from './textarea';

type TextFieldProps = {
  label: string;
  description?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>;

export const TextField = ({ label, description, ...inputProps }: TextFieldProps) => {
  const field = useFieldContext<string>();

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        <Input
          id={field.name}
          value={field.state.value}
          onChange={(e) => field.handleChange(e.target.value)}
          onBlur={field.handleBlur}
          {...inputProps}
        />
      </div>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={field?.state?.meta?.errors} />
    </div>
  );
};

type TextareaFieldProps = {
  label: string;
  description?: ReactNode;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const TextareaField = ({ label, description, ...textareaProps }: TextareaFieldProps) => {
  const field = useFieldContext<string>();

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        <Textarea
          id={field.name}
          value={field.state.value}
          onChange={(e) => field.handleChange(e.target.value)}
          onBlur={field.handleBlur}
          {...textareaProps}
        />
      </div>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={field?.state?.meta?.errors} />
    </div>
  );
};

export const CheckboxField = ({ label, ...inputProps }: TextFieldProps) => {
  const field = useFieldContext<boolean>();

  return (
    <div className="space-y-2">
      <div className="flex flex-row items-center gap-1 space-y-0">
        <Input
          id={field.name}
          type="checkbox"
          checked={field.state.value}
          onChange={(e) => field.handleChange(e.target.checked)}
          onBlur={field.handleBlur}
          {...inputProps}
        />
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      </div>
      <FieldError errors={field?.state?.meta?.errors} />
    </div>
  );
};

interface iSelectFieldProps extends iSingleSelectProps {
  label: string;
}

export const SelectField = ({ label, options, ...selectProps }: iSelectFieldProps) => {
  const field = useFieldContext<string>();

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        <SingleSelect
          id={field.name}
          value={field.state.value}
          onValueChange={(value) => (value ? field.handleChange(value) : undefined)}
          onBlur={field.handleBlur}
          options={options}
          {...selectProps}
        />
      </div>
      <FieldError errors={field?.state?.meta?.errors} />
    </div>
  );
};

const useFormErrors = () => {
  const form = useFormContext();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  const errors = useStore(form.store, (state) => state.errors);
  return { errors, hasErrors: Object.keys(errors).length > 0 };
};

interface iSubmitButtonProps extends Omit<iButtonProps, 'disabled'> {
  isDisabled?: boolean;
}

export function SubmitButton({ children, className, isDisabled, ...props }: iSubmitButtonProps) {
  const form = useFormContext();
  const { hasErrors } = useFormErrors();

  const [isSubmitting, canSubmit] = useStore(form.store, (state) => [state.isSubmitting, state.canSubmit]);

  return (
    <Button
      type="submit"
      disabled={isSubmitting || !canSubmit || !!isDisabled || hasErrors}
      className={className}
      {...props}
    >
      {children}
    </Button>
  );
}
