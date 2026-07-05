import { isDefinedError } from '@orpc/client';
import type { ORPCErrorCode, ORPCError } from '@orpc/client';
import { toast } from 'react-toastify';

import type { iInfoToastData } from './custom-jsx-toasts';
import { ErrorToast, InfoToast } from './custom-jsx-toasts';
import type { CustomToastOptions } from './types';

export const toastError = (title: string, message?: string, options?: CustomToastOptions<iInfoToastData>) => {
  toast(<ErrorToast />, {
    data: {
      title,
      message,
    },
    position: 'top-center',
    closeOnClick: true,
    pauseOnHover: false,
    ...options,
  });
};
export const toastBetterAuthError = (title: string, e: Error, options?: CustomToastOptions<iInfoToastData>) => {
  const cause = e?.cause as { code: string; message: string };
  toastError(title, cause?.message ?? e.message, options);
};

export const toastInfo = (title: string, message?: string, options?: CustomToastOptions<iInfoToastData>) => {
  toast(<InfoToast />, {
    data: {
      title,
      message,
    },
    position: 'top-center',
    closeOnClick: true,
    ...options,
  });
};

export const dismissToastById = (toastId: string | number) => {
  toast.dismiss(toastId);
};

export const dismissAllToasts = () => {
  toast.dismiss();
};

export const toastSuccess = (title: string, message?: string, options?: CustomToastOptions<iInfoToastData>) => {
  toast(<InfoToast />, {
    data: {
      title,
      message,
    },
    position: 'top-center',
    closeOnClick: true,
    ...options,
  });
};

export const toastORPCError = (title: string, error: unknown, options?: CustomToastOptions<iInfoToastData>) => {
  let message = 'An unknown error occurred';

  if (typeof error === 'string') {
    message = error;
  } else if (isDefinedError(error)) {
    message = (error as ORPCError<ORPCErrorCode, unknown>).message;
  } else {
    message = (error as Error)?.message ?? message;
  }

  toastError(title, message, options);
};
