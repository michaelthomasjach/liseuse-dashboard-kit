import { Modal } from "../primitives/Modal";
import { FieldGroup } from "../primitives/FieldGroup";
import { Button } from "../primitives/Button";
import { ColorSwatchButton } from "../primitives/ColorSwatchButton";

export interface LightColorOption {
  id: string;
  label: string;
  color: string;
}

export interface LightWhiteBalanceOption {
  id: string;
  label: string;
}

export interface LightDetailModalProps {
  open: boolean;
  onClose: () => void;
  /** Room/light name shown as the modal title, e.g. "Cuisine". */
  roomName: string;
  on: boolean;
  onPowerChange: (on: boolean) => void;
  whiteBalanceOptions?: LightWhiteBalanceOption[];
  whiteBalance?: string;
  onWhiteBalanceChange?: (id: string) => void;
  colorOptions?: LightColorOption[];
  color?: string;
  onColorChange?: (id: string) => void;
}

/** Detail sheet for a single light: on/off, white-balance presets, and a color picker. */
export function LightDetailModal({
  open,
  onClose,
  roomName,
  on,
  onPowerChange,
  whiteBalanceOptions,
  whiteBalance,
  onWhiteBalanceChange,
  colorOptions,
  color,
  onColorChange,
}: LightDetailModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={roomName}>
      <FieldGroup label="Allumage">
        <Button selected={on} onClick={() => onPowerChange(true)}>
          Allumer
        </Button>
        <Button selected={!on} onClick={() => onPowerChange(false)}>
          Éteindre
        </Button>
      </FieldGroup>

      {whiteBalanceOptions && whiteBalanceOptions.length > 0 && (
        <FieldGroup label="Température">
          {whiteBalanceOptions.map((opt) => (
            <Button
              key={opt.id}
              selected={opt.id === whiteBalance}
              onClick={() => onWhiteBalanceChange?.(opt.id)}
            >
              {opt.label}
            </Button>
          ))}
        </FieldGroup>
      )}

      {colorOptions && colorOptions.length > 0 && (
        <FieldGroup label="Couleur">
          {colorOptions.map((opt) => (
            <ColorSwatchButton
              key={opt.id}
              label={opt.label}
              color={opt.color}
              selected={opt.id === color}
              exclusive
              onClick={() => onColorChange?.(opt.id)}
            />
          ))}
        </FieldGroup>
      )}
    </Modal>
  );
}
