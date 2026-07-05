import { ToastBody, ToastDescription, ToastTitle } from './common-toast-parts';
import type { CustomReferenceToastFC } from './types';

export interface iInfoToastData {
  title: string;
  message?: string;
}

export const InfoToast: CustomReferenceToastFC<iInfoToastData> = ({ data }) => (
  <ToastBody className="flex flex-col gap-2">
    <ToastTitle className="text-sm font-medium text-accent-foreground">{data?.title}</ToastTitle>
    {data?.message ? <ToastDescription>{data?.message}</ToastDescription> : null}
  </ToastBody>
);

export interface iErrorToastData {
  title: string;
  message?: string;
}

export const ErrorToast: CustomReferenceToastFC<iErrorToastData> = ({ data }) => (
  <ToastBody className="flex flex-col gap-2">
    <ToastTitle className="text-sm font-medium text-red-500">{data?.title}</ToastTitle>
    {data?.message ? <ToastDescription>{data?.message}</ToastDescription> : null}
  </ToastBody>
);

export interface iSuccessToastData {
  title: string;
  message?: string;
}

export const SuccessToast: CustomReferenceToastFC<iSuccessToastData> = ({ data }) => (
  <ToastBody className="flex flex-col gap-2">
    <ToastTitle className="text-sm font-medium text-green-500">{data?.title}</ToastTitle>
    {data?.message ? <ToastDescription>{data?.message}</ToastDescription> : null}
  </ToastBody>
);
