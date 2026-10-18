export { Popover } from "./Popover";
export type { PopoverProps } from "./Popover";

export { Select } from "./Select";
export type { SelectProps, SelectOption } from "./Select";

export { Input } from "./Input";
export type { InputProps } from "./Input";

export { MaskedInput } from "./MaskedInput";
export type { MaskedInputProps } from "./MaskedInput";

export { PhoneInput } from "./PhoneInput";
export type { PhoneInputProps } from "./PhoneInput";

export { CreditCardInput } from "./CreditCardInput";
export type { CreditCardInputProps } from "./CreditCardInput";

export { DateInput } from "./DateInput";
export type { DateInputProps } from "./DateInput";

export { InputNumber } from "./InputNumber";
export type { InputNumberProps } from "./InputNumber";

export { InputPassword } from "./InputPassword";
export type { InputPasswordProps } from "./InputPassword";

export { DatePicker } from "./DatePicker";
export type { DatePickerProps } from "./DatePicker";

export { DateRangePicker } from "./DateRangePicker";
export type { DateRangePickerProps, DateRange } from "./DateRangePicker";

export { DateTimePicker } from "./DateTimePicker";
export type { DateTimePickerProps } from "./DateTimePicker";

export { RangeSlider } from "./RangeSlider";
export type { RangeSliderProps } from "./RangeSlider";

export { Dropzone } from "./Dropzone";
export type { DropzoneProps } from "./Dropzone";

export { Checkbox } from "./Checkbox";
export type { CheckboxProps } from "./Checkbox";

export { CheckboxButton } from "./CheckboxButton";
export type { CheckboxButtonProps } from "./CheckboxButton";

export { Tag } from "./Tag";
export type { TagProps } from "./Tag";

export { Chip, ChipGroup } from "./Chip";
export type { ChipProps, ChipGroupProps, ChipGroupOption, ChipGroupSingleProps, ChipGroupMultipleProps } from "./Chip";

export { TagInput } from "./TagInput";
export type { TagInputProps, TagInputSuggestion } from "./TagInput";

export type { PopoverPlacement } from "./internal/usePopoverPosition";

export { WysiwygEditor, WYSIWYG_DEFAULT_TOOLBAR } from "./WysiwygEditor";
export type { WysiwygEditorProps, WysiwygTool, WysiwygBlock } from "./WysiwygEditor";

export { InputDropdown } from "./InputDropdown";
export type { InputDropdownProps, InputDropdownOption } from "./InputDropdown";

// Anciens noms (avant le renommage « XxxField » → « InputXxx ») : conservés pour ne rien casser chez les
// applications existantes. À remplacer par Input, InputNumber et InputPassword.
import { Input } from "./Input";
import { InputNumber } from "./InputNumber";
import { InputPassword } from "./InputPassword";
import type { InputProps } from "./Input";
import type { InputNumberProps } from "./InputNumber";
import type { InputPasswordProps } from "./InputPassword";
/** @deprecated Renommé `Input`. */
export const TextField = Input;
/** @deprecated Renommé `InputProps`. */
export type TextFieldProps = InputProps;
/** @deprecated Renommé `InputNumber`. */
export const NumberField = InputNumber;
/** @deprecated Renommé `InputNumberProps`. */
export type NumberFieldProps = InputNumberProps;
/** @deprecated Renommé `InputPassword`. */
export const PasswordField = InputPassword;
/** @deprecated Renommé `InputPasswordProps`. */
export type PasswordFieldProps = InputPasswordProps;
