import { ClientOnly } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import { merge } from 'lodash-es';
import {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Dispatch, ReactElement, Ref, RefAttributes, SetStateAction, UIEvent, WheelEvent } from 'react';
import { LuCheck, LuChevronDown, LuX } from 'react-icons/lu';
import { components, createFilter } from 'react-select';
import type {
  ActionMeta,
  DropdownIndicatorProps,
  GroupBase,
  MultiValueRemoveProps,
  ClearIndicatorProps,
  OptionProps,
  MenuProps,
  MenuListProps,
  SingleValueProps,
  Props,
  SelectInstance,
} from 'react-select';
import CreatableSelectComponent from 'react-select/creatable';
import type { CreatableProps } from 'react-select/creatable';

import { isOnClient } from '@~/utils/ssr-helpers';

import { DEFAULT_SELECT_CLASSNAMES, DEFAULT_SELECT_STYLES } from './constants';
import type { iOptionType } from './types';

/**
 * React select custom components
 */
export const DropdownIndicator = (props: DropdownIndicatorProps<iOptionType>) => (
  <components.DropdownIndicator {...props}>
    <LuChevronDown className="h-4 w-4 opacity-50" />
  </components.DropdownIndicator>
);

export const ClearIndicator = (props: ClearIndicatorProps<iOptionType>) => (
  <components.ClearIndicator {...props}>
    <LuX className="h-4 w-4 opacity-50" />
  </components.ClearIndicator>
);

export const MultiValueRemove = (props: MultiValueRemoveProps<iOptionType>) => (
  <components.MultiValueRemove {...props}>
    <LuX className="h-3.5 w-3.5 opacity-50" />
  </components.MultiValueRemove>
);

export const Option = (props: OptionProps<iOptionType, boolean, GroupBase<iOptionType>>) => {
  const { data, isSelected, label } = props;
  const { icon, description, meta } = data;

  return (
    <components.Option {...props}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {icon ? (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">{icon}</span>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{label}</div>
            {description ? <div className="truncate text-xs text-muted-foreground">{description}</div> : null}
          </div>
        </div>
        {meta || isSelected ? (
          <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
            {meta}
            {isSelected ? <LuCheck className="h-4 w-4" /> : null}
          </div>
        ) : null}
      </div>
    </components.Option>
  );
};

export const SingleValue = (props: SingleValueProps<iOptionType, boolean, GroupBase<iOptionType>>) => {
  const { data, children } = props;
  const { icon, description, meta } = data;

  return (
    <components.SingleValue {...props}>
      <div className="flex min-w-0 items-center gap-2">
        {icon ? (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">{icon}</span>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate font-medium">{children}</span>
          {description ? <span className="truncate text-xs text-muted-foreground">{description}</span> : null}
        </div>
        {meta ? <span className="shrink-0 text-xs text-muted-foreground">{meta}</span> : null}
      </div>
    </components.SingleValue>
  );
};

// Using Menu and MenuList fixes the scrolling behavior
export const Menu = ({ children, ...props }: MenuProps<iOptionType>) => (
  <components.Menu {...props}>{children}</components.Menu>
);

const isNewOptionValid = () => false;
const INITIAL_OPTION_BATCH_SIZE = 50;
const OPTION_BATCH_SIZE = 50;
const COMPACT_OPTION_HEIGHT = 35;
const OPTION_WITH_DESCRIPTION_HEIGHT = 50;
const LOAD_MORE_THRESHOLD = COMPACT_OPTION_HEIGHT * 3;
const VIRTUAL_OPTION_OVERSCAN = 20;

interface iSelectVirtualizationState {
  optionLimit: number;
  setOptionLimit: Dispatch<SetStateAction<number>>;
}

const DEFAULT_SELECT_VIRTUALIZATION_STATE = {
  optionLimit: INITIAL_OPTION_BATCH_SIZE,
  setOptionLimit: () => undefined,
} satisfies iSelectVirtualizationState;

const SelectVirtualizationContext = createContext<iSelectVirtualizationState>(DEFAULT_SELECT_VIRTUALIZATION_STATE);

const handleMenuWheel = (event: WheelEvent<HTMLDivElement>) => {
  event.stopPropagation();
};

const getEstimatedOptionHeight = (option: unknown) =>
  isValidElement<OptionProps<iOptionType>>(option) && option.props.data?.description
    ? OPTION_WITH_DESCRIPTION_HEIGHT
    : COMPACT_OPTION_HEIGHT;

export const MenuList = (props: MenuListProps<iOptionType>) => {
  const { children, className, focusedOption, innerProps, innerRef, maxHeight } = props;
  const childrenArray = Children.toArray(children);
  const { optionLimit, setOptionLimit } = useContext(SelectVirtualizationContext);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const loadedOptionCount = Math.min(optionLimit, childrenArray.length);
  const focusedOptionIndex = childrenArray.findIndex(
    (child) => isValidElement<OptionProps<iOptionType>>(child) && child.props.data?.value === focusedOption?.value,
  );
  const virtualizer = useVirtualizer({
    count: loadedOptionCount,
    estimateSize: (index) => getEstimatedOptionHeight(childrenArray[index]),
    getScrollElement: () => scrollElementRef.current,
    overscan: VIRTUAL_OPTION_OVERSCAN,
    useFlushSync: false,
  });

  const setScrollElementRef = useCallback(
    (element: HTMLDivElement | null) => {
      scrollElementRef.current = element;
      if (typeof innerRef === 'function') {
        innerRef(element);
      } else if (innerRef) {
        innerRef.current = element;
      }
    },
    [innerRef],
  );

  useEffect(() => {
    if (focusedOptionIndex < 0) {
      return;
    }

    const requiredOptionCount = Math.min(
      childrenArray.length,
      Math.ceil((focusedOptionIndex + 1) / OPTION_BATCH_SIZE) * OPTION_BATCH_SIZE,
    );
    if (requiredOptionCount > optionLimit) {
      setOptionLimit(requiredOptionCount);
      return;
    }

    const scrollElement = scrollElementRef.current;
    const focusedOptionOffset = virtualizer.getOffsetForIndex(focusedOptionIndex, 'auto');
    if (!scrollElement || !focusedOptionOffset) {
      return;
    }

    const [targetOffset] = focusedOptionOffset;
    if (Math.abs(targetOffset - scrollElement.scrollTop) > 1) {
      virtualizer.scrollToIndex(focusedOptionIndex, { align: 'auto' });
    }
  }, [childrenArray.length, focusedOptionIndex, optionLimit, setOptionLimit, virtualizer]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    innerProps.onScroll?.(event);
    const { clientHeight, scrollHeight, scrollTop } = event.currentTarget;
    if (scrollHeight - scrollTop - clientHeight <= LOAD_MORE_THRESHOLD) {
      setOptionLimit((currentCount) => Math.min(currentCount + OPTION_BATCH_SIZE, childrenArray.length));
    }
  };

  const listHeight = Math.min(
    maxHeight,
    childrenArray
      .slice(0, loadedOptionCount)
      .reduce<number>((totalHeight, option) => totalHeight + getEstimatedOptionHeight(option), 0),
  );

  if (childrenArray.length <= 1) {
    return <components.MenuList {...props} />;
  }

  return (
    <div
      {...innerProps}
      ref={setScrollElementRef}
      className={className}
      style={{
        ...innerProps.style,
        height: listHeight,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        position: 'relative',
      }}
      onScroll={handleScroll}
      onWheel={handleMenuWheel}
    >
      <div style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {childrenArray[virtualItem.index]}
          </div>
        ))}
      </div>
    </div>
  );
};

const BaseSelect = <IsMulti extends boolean = false>(
  props: CreatableProps<iOptionType, IsMulti, GroupBase<iOptionType>> & {
    isMulti?: IsMulti;
    isDOMTarget?: boolean;
    isCreatable?: boolean;
  },
  ref: Ref<SelectInstance<iOptionType, IsMulti, GroupBase<iOptionType>>>,
) => {
  const {
    styles = DEFAULT_SELECT_STYLES,
    classNames = {},
    components: componentsFromProps = {},
    captureMenuScroll: shouldCaptureMenuScroll = false,
    isDOMTarget = true,
    isCreatable = false,
    isValidNewOption,
    ...rest
  } = props;
  const instanceId = useId();
  const [optionLimit, setOptionLimit] = useState(INITIAL_OPTION_BATCH_SIZE);
  const virtualizationState = useMemo(() => ({ optionLimit, setOptionLimit }), [optionLimit]);

  return (
    <ClientOnly>
      <SelectVirtualizationContext.Provider value={virtualizationState}>
        <CreatableSelectComponent<iOptionType, IsMulti, GroupBase<iOptionType>>
          ref={ref}
          instanceId={instanceId}
          unstyled
          filterOption={createFilter({
            matchFrom: 'any',
            stringify: (option) => option.label,
          })}
          menuPortalTarget={isDOMTarget && isOnClient ? document.body : undefined}
          components={{
            DropdownIndicator,
            ClearIndicator,
            MultiValueRemove,
            Option,
            SingleValue,
            Menu,
            MenuList,
            ...componentsFromProps,
          }}
          styles={styles}
          classNames={merge(DEFAULT_SELECT_CLASSNAMES, classNames)}
          captureMenuScroll={shouldCaptureMenuScroll}
          isValidNewOption={isCreatable ? isValidNewOption : isNewOptionValid}
          {...rest}
        />
      </SelectVirtualizationContext.Provider>
    </ClientOnly>
  );
};

const ForwardedSelect = forwardRef(BaseSelect);

const isGroupOption = (option: iOptionType | GroupBase<iOptionType>): option is GroupBase<iOptionType> =>
  Array.isArray((option as GroupBase<iOptionType>).options);

const flattenOptions = (options?: readonly (iOptionType | GroupBase<iOptionType>)[]): iOptionType[] => {
  if (!options) return [];
  const flattened: iOptionType[] = [];

  options.forEach((entry) => {
    if (isGroupOption(entry)) {
      flattened.push(...entry.options);
    } else {
      flattened.push(entry);
    }
  });

  return flattened;
};

type SingleSelectBaseProps = Props<iOptionType, false, GroupBase<iOptionType>>;
type MultiSelectBaseProps = Props<iOptionType, true, GroupBase<iOptionType>>;
type CreatableSingleSelectBaseProps = CreatableProps<iOptionType, false, GroupBase<iOptionType>>;

const ForwardedSelectSingle = forwardRef<
  SelectInstance<iOptionType, false, GroupBase<iOptionType>>,
  SingleSelectBaseProps
>((props, ref) => BaseSelect({ ...props, isMulti: false }, ref));

const ForwardedSelectMulti = forwardRef<
  SelectInstance<iOptionType, true, GroupBase<iOptionType>>,
  MultiSelectBaseProps
>((props, ref) => BaseSelect({ ...props, isMulti: true }, ref));

const ForwardedCreatableSelectSingle = forwardRef<
  SelectInstance<iOptionType, false, GroupBase<iOptionType>>,
  CreatableSingleSelectBaseProps
>((props, ref) => BaseSelect({ ...props, isMulti: false, isCreatable: true }, ref));

export interface iSingleSelectProps extends Omit<
  SingleSelectBaseProps,
  'value' | 'defaultValue' | 'onChange' | 'isMulti'
> {
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null, option: iOptionType | null, action: ActionMeta<iOptionType>) => void;
  onOptionChange?: NonNullable<SingleSelectBaseProps['onChange']>;
}

export const SingleSelect = forwardRef<SelectInstance<iOptionType, false, GroupBase<iOptionType>>, iSingleSelectProps>(
  // eslint-disable-next-line prefer-arrow-callback
  function SingleSelect({ value, defaultValue, onValueChange, onOptionChange, options, ...rest }, ref) {
    const flatOptions = useMemo(() => flattenOptions(options), [options]);

    const computedValue = useMemo<iOptionType | null | undefined>(() => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      return flatOptions.find((option) => option.value === value) ?? null;
    }, [flatOptions, value]);

    const computedDefaultValue = useMemo<iOptionType | null | undefined>(() => {
      if (defaultValue === undefined) return undefined;
      if (defaultValue === null) return null;
      return flatOptions.find((option) => option.value === defaultValue) ?? null;
    }, [defaultValue, flatOptions]);

    return (
      <ForwardedSelectSingle
        {...rest}
        ref={ref}
        options={options}
        value={computedValue}
        defaultValue={computedDefaultValue}
        onChange={(selected, actionMeta) => {
          onOptionChange?.(selected, actionMeta);
          const normalizedOption = selected ?? null;
          onValueChange?.(normalizedOption?.value ?? null, normalizedOption, actionMeta);
        }}
      />
    );
  },
);

export interface iCreatableSingleSelectProps extends Omit<
  CreatableSingleSelectBaseProps,
  'value' | 'defaultValue' | 'onChange' | 'isMulti'
> {
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null, option: iOptionType | null, action: ActionMeta<iOptionType>) => void;
  onOptionChange?: NonNullable<CreatableSingleSelectBaseProps['onChange']>;
}

export const CreatableSingleSelect = forwardRef<
  SelectInstance<iOptionType, false, GroupBase<iOptionType>>,
  iCreatableSingleSelectProps
>(
  // eslint-disable-next-line prefer-arrow-callback
  function CreatableSingleSelect({ value, defaultValue, onValueChange, onOptionChange, options, ...rest }, ref) {
    const flatOptions = useMemo(() => flattenOptions(options), [options]);

    const computedValue = useMemo<iOptionType | null | undefined>(() => {
      if (value === undefined) return undefined;
      if (value === null || value === '') return null;
      return flatOptions.find((option) => option.value === value) ?? { label: value, value };
    }, [flatOptions, value]);

    const computedDefaultValue = useMemo<iOptionType | null | undefined>(() => {
      if (defaultValue === undefined) return undefined;
      if (defaultValue === null || defaultValue === '') return null;
      return (
        flatOptions.find((option) => option.value === defaultValue) ?? { label: defaultValue, value: defaultValue }
      );
    }, [defaultValue, flatOptions]);

    return (
      <ForwardedCreatableSelectSingle
        {...rest}
        ref={ref}
        options={options}
        value={computedValue}
        defaultValue={computedDefaultValue}
        onChange={(selected, actionMeta) => {
          onOptionChange?.(selected, actionMeta);
          const normalizedOption = selected ?? null;
          onValueChange?.(normalizedOption?.value ?? null, normalizedOption, actionMeta);
        }}
      />
    );
  },
);

export interface iMultiSelectProps extends Omit<
  MultiSelectBaseProps,
  'value' | 'defaultValue' | 'onChange' | 'isMulti'
> {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (values: string[], options: Array<iOptionType>, action: ActionMeta<iOptionType>) => void;
  onOptionChange?: NonNullable<MultiSelectBaseProps['onChange']>;
}

export const MultiSelect = forwardRef<SelectInstance<iOptionType, true, GroupBase<iOptionType>>, iMultiSelectProps>(
  // eslint-disable-next-line prefer-arrow-callback
  function MultiSelect(
    { value, defaultValue, onValueChange, onOptionChange, options, closeMenuOnSelect = false, ...rest },
    ref,
  ) {
    const flatOptions = useMemo(() => flattenOptions(options), [options]);

    const computedValue = useMemo<readonly iOptionType[] | undefined>(() => {
      if (value === undefined) return undefined;
      if (!value || value.length === 0) return [];
      const lookup = new Set(value);
      return flatOptions.filter((option) => lookup.has(option.value));
    }, [flatOptions, value]);

    const computedDefaultValue = useMemo<readonly iOptionType[] | undefined>(() => {
      if (defaultValue === undefined) return undefined;
      if (!defaultValue || defaultValue.length === 0) return [];
      const lookup = new Set(defaultValue);
      return flatOptions.filter((option) => lookup.has(option.value));
    }, [defaultValue, flatOptions]);

    return (
      <ForwardedSelectMulti
        {...rest}
        ref={ref}
        isMulti
        closeMenuOnSelect={closeMenuOnSelect}
        options={options}
        value={computedValue}
        defaultValue={computedDefaultValue}
        onChange={(selected, actionMeta) => {
          onOptionChange?.(selected, actionMeta);
          const normalizedOptions = Array.isArray(selected) ? [...selected] : [];
          onValueChange?.(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            normalizedOptions.map((option) => option.value),
            normalizedOptions,
            actionMeta,
          );
        }}
      />
    );
  },
);

export default ForwardedSelect as <IsMulti extends boolean = false>(
  p: Props<iOptionType, IsMulti> & {
    ref?: RefAttributes<SelectInstance<iOptionType, IsMulti, GroupBase<iOptionType>>>['ref'];

    isMulti?: IsMulti;
  },
) => ReactElement;
