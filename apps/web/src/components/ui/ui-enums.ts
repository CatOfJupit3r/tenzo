import { em } from 'enumwaii';

export const ALERT_VARIANTS_ENUM = em({
  DEFAULT: 'default',
  DESTRUCTIVE: 'destructive',
});
export const ALERT_VARIANTS = ALERT_VARIANTS_ENUM.rawEnum;

export const BADGE_VARIANTS_ENUM = em({
  DEFAULT: 'default',
  SECONDARY: 'secondary',
  DESTRUCTIVE: 'destructive',
  OUTLINE: 'outline',
});
export const BADGE_VARIANTS = BADGE_VARIANTS_ENUM.rawEnum;

export const CROPPER_OBJECT_FITS_ENUM = em({
  CONTAIN: 'contain',
  COVER: 'cover',
  HORIZONTAL_COVER: 'horizontal-cover',
  VERTICAL_COVER: 'vertical-cover',
});

export const CROPPER_OBJECT_FITS = CROPPER_OBJECT_FITS_ENUM.rawEnum;

export const CROPPER_SHAPES_ENUM = em({
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
});

export const CROPPER_SHAPES = CROPPER_SHAPES_ENUM.rawEnum;

export const DROPDOWN_MENU_VARIANTS_ENUM = em({
  DEFAULT: 'default',
  DESTRUCTIVE: 'destructive',
});

export const DROPDOWN_MENU_VARIANTS = DROPDOWN_MENU_VARIANTS_ENUM.rawEnum;

export const EMPTY_MEDIA_VARIANTS_ENUM = em({
  DEFAULT: 'default',
  ICON: 'icon',
});
export const EMPTY_MEDIA_VARIANTS = EMPTY_MEDIA_VARIANTS_ENUM.rawEnum;

export const FIELD_LEGEND_VARIANTS_ENUM = em({
  LEGEND: 'legend',
  LABEL: 'label',
});

export const FIELD_LEGEND_VARIANTS = FIELD_LEGEND_VARIANTS_ENUM.rawEnum;

export const FIELD_ORIENTATIONS_ENUM = em({
  VERTICAL: 'vertical',
  HORIZONTAL: 'horizontal',
  RESPONSIVE: 'responsive',
});
export const FIELD_ORIENTATIONS = FIELD_ORIENTATIONS_ENUM.rawEnum;

export const ITEM_VARIANTS_ENUM = em({
  DEFAULT: 'default',
  OUTLINE: 'outline',
  MUTED: 'muted',
});
export const ITEM_VARIANTS = ITEM_VARIANTS_ENUM.rawEnum;

export const ITEM_SIZES_ENUM = em({
  DEFAULT: 'default',
  SM: 'sm',
});
export const ITEM_SIZES = ITEM_SIZES_ENUM.rawEnum;

export const ITEM_MEDIA_VARIANTS_ENUM = em({
  DEFAULT: 'default',
  ICON: 'icon',
  IMAGE: 'image',
});
export const ITEM_MEDIA_VARIANTS = ITEM_MEDIA_VARIANTS_ENUM.rawEnum;

export const MESSAGE_ALIGNMENTS_ENUM = em({
  START: 'start',
  END: 'end',
});

export const MESSAGE_ALIGNMENTS = MESSAGE_ALIGNMENTS_ENUM.rawEnum;

export const TOGGLE_VARIANTS_ENUM = em({
  DEFAULT: 'default',
  OUTLINE: 'outline',
});
export const TOGGLE_VARIANTS = TOGGLE_VARIANTS_ENUM.rawEnum;

export const TOGGLE_SIZES_ENUM = em({
  DEFAULT: 'default',
  SM: 'sm',
  LG: 'lg',
});
export const TOGGLE_SIZES = TOGGLE_SIZES_ENUM.rawEnum;

export const BUTTON_VARIANTS_ENUM = em({
  DEFAULT: 'default',
  DESTRUCTIVE: 'destructive',
  OUTLINE: 'outline',
  SECONDARY: 'secondary',
  GHOST: 'ghost',
  LINK: 'link',
});
export const BUTTON_VARIANTS = BUTTON_VARIANTS_ENUM.rawEnum;

export const BUTTON_SIZES_ENUM = em({
  DEFAULT: 'default',
  SM: 'sm',
  LG: 'lg',
  ICON: 'icon',
});
export const BUTTON_SIZES = BUTTON_SIZES_ENUM.rawEnum;
