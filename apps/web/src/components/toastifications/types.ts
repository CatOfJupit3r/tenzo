import type { FC, JSX } from 'react';
import type { ToastContentProps, ToastOptions } from 'react-toastify';

export type CustomToastOptions<TData = unknown> = Exclude<ToastOptions<TData>, 'data'>;
type PartialFC<T> = FC<Partial<T>>;

export type CustomToastFC<TData = unknown> = PartialFC<ToastContentProps<TData>>;
export type CustomReferenceToastFC<TData = unknown> = (props: ToastOptions<TData>) => JSX.Element;
